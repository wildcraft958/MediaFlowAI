"""
LangGraph 4-node QnA Agent:
  Router → (standard_kpi → Analytics | ad_hoc → Text2SQL) → Narrate

Checkpointer: MemorySaver for multi-turn session memory.
"""
from __future__ import annotations
import pathlib
import sys
import duckdb

sys.path.insert(0, str(pathlib.Path(__file__).parents[1]))

from typing import Any
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from agents.graph_state import AgentState
from agents.text2sql.schema_linker import link_schema
from agents.text2sql.query_planner import plan_query
from agents.text2sql.sql_generator import generate_sql
from agents.text2sql.guardrails import check, check_columns
from agents.text2sql.correction_loop import run_correction_loop

DB_PATH = str(pathlib.Path(__file__).parents[1] / "frammer.duckdb")
_SIMILARITY_THRESHOLD = 0.6  # ChromaDB cosine distance (lower = more similar)

# ── DB executor ──────────────────────────────────────────────────────────────

_db_conn = None

def _execute_sql(sql: str) -> tuple[list[dict] | None, str | None]:
    global _db_conn
    try:
        if _db_conn is None:
            _db_conn = duckdb.connect(DB_PATH, read_only=True)
        df = _db_conn.execute(sql).df()
        return df.to_dict(orient="records"), None
    except Exception as e:
        return None, str(e)


# ── Router node ───────────────────────────────────────────────────────────────

def router_node(state: AgentState) -> AgentState:
    query = state.get("query", "")
    thought_steps = state.get("thought_steps", [])

    intent = "ad_hoc"
    try:
        from agents.vector_store import query_kpi_similarity
        matches = query_kpi_similarity(query, n_results=1)
        if matches and matches[0]["distance"] < _SIMILARITY_THRESHOLD:
            intent = "standard_kpi"
            thought_steps.append({
                "node": "Router",
                "action": "classify",
                "detail": f"standard_kpi (matched: {matches[0]['acronym']}, dist={matches[0]['distance']:.3f})"
            })
        else:
            thought_steps.append({
                "node": "Router",
                "action": "classify",
                "detail": "ad_hoc (no strong KPI match)"
            })
    except Exception as e:
        thought_steps.append({"node": "Router", "action": "error", "detail": str(e)})

    return {**state, "intent": intent, "thought_steps": thought_steps}


# ── Analytics node (standard KPI path) ───────────────────────────────────────

def analytics_node(state: AgentState) -> AgentState:
    query = state.get("query", "")
    thought_steps = list(state.get("thought_steps", []))

    try:
        from agents.vector_store import query_kpi_similarity
        matches = query_kpi_similarity(query, n_results=1)
        if not matches:
            return {**state, "error": "No KPI matched", "thought_steps": thought_steps}

        acronym = matches[0]["acronym"]
        import yaml
        cfg_path = pathlib.Path(__file__).parents[1] / "config" / "metric_registry.yaml"
        with open(cfg_path) as f:
            registry = yaml.safe_load(f)["metrics"]

        kpi = registry.get(acronym)
        source = kpi.get("view") or kpi.get("table")
        sql = f"SELECT * FROM {source}"
        result, error = _execute_sql(sql)

        thought_steps.append({
            "node": "Analytics",
            "action": "run_kpi",
            "detail": f"KPI={acronym}, source={source}, rows={len(result) if result else 0}"
        })
        return {**state, "sql": sql, "result": result, "error": error, "thought_steps": thought_steps}
    except Exception as e:
        return {**state, "error": str(e), "thought_steps": thought_steps}


# ── Text2SQL node (ad-hoc path) ───────────────────────────────────────────────

def text2sql_node(state: AgentState) -> AgentState:
    query = state.get("query", "")
    thought_steps = list(state.get("thought_steps", []))

    # Step 1: Schema linking
    linked = link_schema(query)
    thought_steps.append({
        "node": "Text2SQL",
        "action": "schema_link",
        "detail": f"Linked columns: {list(linked.keys())}"
    })

    # Step 2: Query planning
    plan = plan_query(query, linked)
    thought_steps.append({
        "node": "Text2SQL",
        "action": "query_plan",
        "detail": plan[:200]
    })

    # Step 3: SQL generation
    sql = generate_sql(query, plan)
    thought_steps.append({
        "node": "Text2SQL",
        "action": "sql_gen",
        "detail": sql[:300]
    })

    # Step 4: Guardrails
    safe, errors = check(sql)
    if not safe:
        thought_steps.append({"node": "Text2SQL", "action": "guardrails_fail", "detail": str(errors)})
        return {**state, "sql": sql, "error": f"Guardrails blocked: {errors}", "thought_steps": thought_steps}

    col_safe, col_errors = check_columns(sql)
    if not col_safe:
        # Attempt to regenerate with column error as context
        thought_steps.append({"node": "Text2SQL", "action": "column_check_fail", "detail": str(col_errors)})

    # Step 5: Correction loop
    final_sql, result, error = run_correction_loop(query, sql, _execute_sql)
    thought_steps.append({
        "node": "Text2SQL",
        "action": "correction_loop",
        "detail": f"final_sql_len={len(final_sql)}, rows={len(result) if result else 0}, error={error}"
    })

    return {**state, "sql": final_sql, "result": result, "error": error, "thought_steps": thought_steps}


# ── Narrate node ──────────────────────────────────────────────────────────────

def narrate_node(state: AgentState) -> AgentState:
    query = state.get("query", "")
    result = state.get("result")
    error = state.get("error")
    sql = state.get("sql", "")
    thought_steps = list(state.get("thought_steps", []))

    if error and not result:
        narrative = f"I was unable to answer that question. Error: {error}"
        return {**state, "narrative": narrative, "thought_steps": thought_steps}

    if not result:
        return {**state, "narrative": "No data found for that query.", "thought_steps": thought_steps}

    # Build chart_spec from result
    chart_spec = _infer_chart_spec(result, sql)

    # Generate narrative via Claude
    narrative = _generate_narrative(query, result, sql)

    thought_steps.append({
        "node": "Narrate",
        "action": "narrate",
        "detail": f"narrative_len={len(narrative)}, chart_type={chart_spec.get('type','none')}"
    })

    return {**state, "narrative": narrative, "chart_spec": chart_spec, "thought_steps": thought_steps}


def _infer_chart_spec(result: list[dict], sql: str) -> dict:
    if not result:
        return {"type": "none"}
    first = result[0]
    keys = list(first.keys())
    # Simple heuristic
    if len(result) > 1 and len(keys) >= 2:
        x_key = keys[0]
        y_keys = [k for k in keys[1:] if isinstance(first.get(k), (int, float))]
        if y_keys:
            return {"type": "bar", "x": x_key, "y": y_keys, "data": result[:50]}
    return {"type": "table", "data": result[:50]}


def _generate_narrative(query: str, result: list[dict], sql: str) -> str:
    try:
        import json
        from api.llm import complete
        sample = json.dumps(result[:5], default=str)
        prompt = (
            f"Question: {query}\n\n"
            f"Data sample (first 5 rows):\n{sample}\n\n"
            f"Total rows: {len(result)}\n\n"
            "Write a 1-2 sentence insight in plain English. "
            "Be specific with numbers. No preamble."
        )
        return complete(prompt, max_tokens=256)
    except Exception as e:
        return f"Found {len(result)} result(s). (Narrative error: {e})"


# ── Graph assembly ─────────────────────────────────────────────────────────────

def _route_after_router(state: AgentState) -> str:
    return "analytics" if state.get("intent") == "standard_kpi" else "text2sql"


def _build_graph() -> StateGraph:
    builder = StateGraph(AgentState)
    builder.add_node("router", router_node)
    builder.add_node("analytics", analytics_node)
    builder.add_node("text2sql", text2sql_node)
    builder.add_node("narrate", narrate_node)

    builder.set_entry_point("router")
    builder.add_conditional_edges("router", _route_after_router, {
        "analytics": "analytics",
        "text2sql": "text2sql",
    })
    builder.add_edge("analytics", "narrate")
    builder.add_edge("text2sql", "narrate")
    builder.add_edge("narrate", END)
    return builder


_checkpointer = MemorySaver()
_graph = _build_graph().compile(checkpointer=_checkpointer)


async def run_qna_agent(
    query: str,
    session_id: str = "default",
    persona: str = "leadership",
    filters: dict | None = None,
) -> dict[str, Any]:
    """Main entry point — called by /api/nlq endpoint."""
    initial_state: AgentState = {
        "session_id": session_id,
        "persona": persona,
        "client_id": "CLIENT_1",
        "query": query,
        "filters": filters or {},
        "thought_steps": [],
        "history": [],
        "intent": "",
        "sql": None,
        "result": None,
        "chart_spec": None,
        "narrative": None,
        "error": None,
    }
    config = {"configurable": {"thread_id": session_id}}
    final = await _graph.ainvoke(initial_state, config=config)
    return final
