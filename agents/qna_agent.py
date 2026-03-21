"""
LangGraph 4+2 node QnA Agent — LangChain/LangGraph v1, langchain-mcp-adapters 0.2.x
  Router → (standard_kpi → Analytics | ad_hoc → Text2SQL) → Narrate
  Analytics may route to → HITL → FireAlertAction → Narrate

Patterns used (latest as of LangGraph v1):
- InMemorySaver checkpointer — per-session multi-turn history
- InMemoryStore — cross-session long-term memory
- MultiServerMCPClient (stateless) — kpi_server, alert_server, report_server via stdio
- Command[Literal[...]] — combined state update + routing from Router/Analytics nodes
- interrupt() — HITL pause inside hitl_node; resumes via Command(resume=decision)
- Async analytics_node — direct MCP tool invocation via ainvoke
- stream_qna_agent() — astream with stream_mode="updates" → SSE events
- add_edge(START, ...) — replaces deprecated set_entry_point
"""
from __future__ import annotations

import concurrent.futures
import json
import pathlib
import re
import sys
import time
from typing import Any, AsyncGenerator, Literal, Optional

sys.path.insert(0, str(pathlib.Path(__file__).parents[1]))

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.store.memory import InMemoryStore
from langgraph.store.base import BaseStore
from langgraph.types import Command, interrupt

from agents.graph_state import AgentState
from agents.middleware import MediaFlowInputGuardrail, MediaFlowOutputGuardrail
from agents.text2sql.schema_linker import link_schema, SchemaLink
from agents.text2sql.query_planner import plan_query, QueryPlan
from agents.text2sql.sql_generator import generate_sql, GeneratedSQL
from agents.text2sql.guardrails import check_all, GuardrailResult
from agents.text2sql.correction_loop import run_correction_loop

DB_PATH = str(pathlib.Path(__file__).parents[1] / "analytics.duckdb")
_SIMILARITY_THRESHOLD = 0.75
_SQL_TIMEOUT_SECS = 30
_MAX_RESULT_ROWS = 5_000

# ── Long-term store (cross-session memory) ─────────────────────────────────────
_store = InMemoryStore()


# ── DB executor (thread-safe: fresh connection per call, with timeout) ─────────

def _execute_sql(sql: str) -> tuple[list[dict] | None, str | None]:
    """
    Execute SQL against DuckDB with a 30s timeout and 5,000-row cap.

    Opens a fresh read-only connection inside a thread so:
      - The singleton _db_conn is not shared across threads (DuckDB is not thread-safe)
      - The ThreadPoolExecutor enforces a hard wall-clock timeout
    """
    def _run():
        import duckdb
        conn = duckdb.connect(DB_PATH, read_only=True)
        try:
            rel = conn.execute(sql)
            rows = rel.fetchmany(_MAX_RESULT_ROWS + 1)
            cols = [d[0] for d in rel.description]
            return rows, cols
        finally:
            conn.close()

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(_run)
            rows, cols = future.result(timeout=_SQL_TIMEOUT_SECS)

        truncated = len(rows) > _MAX_RESULT_ROWS
        if truncated:
            rows = rows[:_MAX_RESULT_ROWS]

        result = [dict(zip(cols, r)) for r in rows]
        if truncated:
            # Append a sentinel so callers can surface a truncation warning
            result.append({"__truncated__": True, "__limit__": _MAX_RESULT_ROWS})

        return result, None

    except concurrent.futures.TimeoutError:
        return None, f"SQL timeout: query exceeded {_SQL_TIMEOUT_SECS}s limit"
    except Exception as e:
        return None, str(e)


# ── MCP client (stateless singleton) ──────────────────────────────────────────

_mcp_client = None
_mcp_tools: dict[str, Any] = {}
_mcp_initialized = False


async def _init_mcp() -> dict[str, Any]:
    """
    Lazily build the MCP tool registry from kpi_server, alert_server, report_server.
    Returns {tool_name: tool} for direct ainvoke() calls from nodes.
    Falls back to {} if servers fail to start (agent degrades gracefully).
    """
    global _mcp_client, _mcp_tools, _mcp_initialized
    if _mcp_initialized:
        return _mcp_tools
    _mcp_initialized = True
    try:
        from langchain_mcp_adapters.client import MultiServerMCPClient
        _agents_dir = pathlib.Path(__file__).parent
        _mcp_client = MultiServerMCPClient(
            {
                "kpi_server": {
                    "command": sys.executable,
                    "args": [str(_agents_dir / "mcp_servers" / "kpi_server.py")],
                    "transport": "stdio",
                },
                "alert_server": {
                    "command": sys.executable,
                    "args": [str(_agents_dir / "mcp_servers" / "alert_server.py")],
                    "transport": "stdio",
                },
                "report_server": {
                    "command": sys.executable,
                    "args": [str(_agents_dir / "mcp_servers" / "report_server.py")],
                    "transport": "stdio",
                },
                "context_server": {
                    "command": sys.executable,
                    "args": [str(_agents_dir / "mcp_servers" / "context_server.py")],
                    "transport": "stdio",
                },
            }
        )
        tools_list = await _mcp_client.get_tools()
        _mcp_tools = {t.name: t for t in tools_list}
    except Exception:
        _mcp_tools = {}
    return _mcp_tools


# ── Guardrail middleware singletons ───────────────────────────────────────────

_input_guardrail = MediaFlowInputGuardrail()
_output_guardrail = MediaFlowOutputGuardrail()


# ── Guardrail nodes ────────────────────────────────────────────────────────────

def input_guardrail_node(state: AgentState) -> AgentState | Command:
    """
    First node in the graph. Validates/sanitizes the inbound query.
    On hard block (out-of-scope, sensitive content): returns Command(goto='narrate')
    so narrate picks up the pre-set narrative without re-generating.
    """
    result = _input_guardrail.before_agent(state)
    if result.get("error"):
        return Command(update=result, goto="narrate")
    return result


def output_guardrail_node(state: AgentState) -> AgentState:
    """
    Last node before END. Redacts PII from narrative output, ensures non-empty response.
    """
    return _output_guardrail.after_agent(state)


# ── Router node ────────────────────────────────────────────────────────────────

_CONTEXT_QUERY_SIGNALS = re.compile(
    r"\b(this chart|this page|what I see|what's shown|on screen|what am I looking at|"
    r"what does this show|explain this|what's displayed|current view)\b",
    re.IGNORECASE,
)

# KPI definition/explanation pattern
_KPI_DEFINITION_RE = re.compile(
    r"\b(what\s+is|what(?:'s| is)\s+the\s+meaning\s+of|explain|define|describe)\s+"
    r"([A-Z]{2,5})\b",
    re.IGNORECASE,
)

def _try_kpi_definition(query: str) -> Optional[str]:
    """If query asks for a KPI definition, return the explanation or None."""
    m = _KPI_DEFINITION_RE.search(query)
    if not m:
        return None
    acronym = m.group(2).upper()
    try:
        from api.config import METRIC_REGISTRY
        kpi = METRIC_REGISTRY.get(acronym)
        if kpi:
            return (
                f"**{kpi['name']}** ({acronym})\n\n"
                f"{kpi.get('description', '')}\n\n"
                f"- **Type:** {kpi.get('type', 'sql')}\n"
                f"- **Dashboard page:** {kpi.get('dashboard_page', 'N/A')}\n"
                f"- **Roles:** {', '.join(kpi.get('roles', []))}"
            )
    except Exception:
        pass
    return None


def router_node(
    state: AgentState, *, store: BaseStore
) -> Command[Literal["analytics", "text2sql", "narrate"]]:
    """
    Classify query intent via vector similarity search.

    Uses Command (LangGraph v1) to combine state update + routing in one step.
    - context_aware → narrate node (page/chart context answer, no SQL needed)
    - standard_kpi  → analytics node (matched KPI acronym passed via _matched_acronym)
    - ad_hoc        → text2sql node (full SQL-of-Thought pipeline)

    Also reads/writes long-term store to track query patterns across sessions.
    """
    query = state.get("query", "")
    session_id = state.get("session_id", "default")

    namespace = ("mediaflow", session_id)
    try:
        prior_items = store.search(namespace)
        prior_intents = [m.value.get("intent") for m in prior_items if m.value.get("intent")]
    except Exception:
        prior_intents = []

    thought_steps: list[dict] = []
    intent = "ad_hoc"
    matched_acronym: Optional[str] = None

    # KPI definition lookup: "what is CPDG", "explain PCR", etc.
    kpi_def = _try_kpi_definition(query)
    if kpi_def:
        thought_steps.append({
            "node": "Router",
            "action": "classify",
            "detail": "kpi_definition (matched KPI acronym in definition query)",
        })
        return Command(
            update={
                "intent": "kpi_definition",
                "thought_steps": thought_steps,
                "_matched_acronym": None,
                "_kpi_definition": kpi_def,
                "error": None,
                "result": None,
                "sql": None,
                "chart_spec": None,
                "hitl_pending": False,
                "hitl_payload": None,
                "hitl_decision": None,
                "pending_inbox_items": [],
            },
            goto="narrate",
        )

    # Context-aware routing: if query references visible page/chart content
    has_context = bool(state.get("page_context") or state.get("chart_context"))
    if has_context and _CONTEXT_QUERY_SIGNALS.search(query):
        intent = "context_aware"
        thought_steps.append({
            "node": "Router",
            "action": "classify",
            "detail": "context_aware (query references visible content + context provided)",
        })
        try:
            store.put(namespace, f"q_{int(time.time() * 1000) % 10_000_000}", {
                "query": query[:120],
                "intent": intent,
            })
        except Exception:
            pass
        return Command(
            update={
                "intent": intent,
                "thought_steps": thought_steps,
                "_matched_acronym": None,
                "error": None,
                "result": None,
                "sql": None,
                "narrative": None,
                "chart_spec": None,
                "hitl_pending": False,
                "hitl_payload": None,
                "hitl_decision": None,
                "pending_inbox_items": [],
            },
            goto="narrate",
        )

    try:
        from agents.vector_store import query_kpi_similarity
        matches = query_kpi_similarity(query, n_results=1)
        if matches and matches[0]["score"] >= _SIMILARITY_THRESHOLD:
            intent = "standard_kpi"
            matched_acronym = matches[0]["acronym"]
            thought_steps.append({
                "node": "Router",
                "action": "classify",
                "detail": f"standard_kpi (matched: {matched_acronym}, score={matches[0]['score']:.3f})",
            })
        else:
            hint = f" (prior intents: {prior_intents[-3:]})" if prior_intents else ""
            thought_steps.append({
                "node": "Router",
                "action": "classify",
                "detail": f"ad_hoc (no strong KPI match){hint}",
            })
    except Exception as e:
        thought_steps.append({"node": "Router", "action": "error", "detail": str(e)})

    try:
        store.put(namespace, f"q_{int(time.time() * 1000) % 10_000_000}", {
            "query": query[:120],
            "intent": intent,
        })
    except Exception:
        pass

    return Command(
        update={
            "intent": intent,
            "thought_steps": thought_steps,
            "_matched_acronym": matched_acronym,
            "error": None,
            "result": None,
            "sql": None,
            "narrative": None,
            "chart_spec": None,
            "hitl_pending": False,
            "hitl_payload": None,
            "hitl_decision": None,
            "pending_inbox_items": [],
        },
        goto="analytics" if intent == "standard_kpi" else "text2sql",
    )


# ── Analytics node (standard KPI path) ───────────────────────────────────────

async def analytics_node(
    state: AgentState,
) -> Command[Literal["hitl", "narrate"]]:
    """
    Standard KPI path — invokes run_kpi_query MCP tool from kpi_server.
    Falls back to direct DuckDB query if MCP unavailable.
    After query, calls check_thresholds — routes to HITL if alert found.
    """
    query = state.get("query", "")
    thought_steps = list(state.get("thought_steps", []))
    acronym = state.get("_matched_acronym")

    if not acronym:
        try:
            from agents.vector_store import query_kpi_similarity
            matches = query_kpi_similarity(query, n_results=1)
            if matches:
                acronym = matches[0]["acronym"]
        except Exception:
            pass

    if not acronym:
        return Command(
            update={**state, "error": "No KPI matched", "thought_steps": thought_steps},
            goto="narrate",
        )

    tools = await _init_mcp()
    result = None
    sql = None
    error = None

    if "run_kpi_query" in tools:
        try:
            raw = await tools["run_kpi_query"].ainvoke(
                {"kpi_name": acronym, "filters": state.get("filters", {})}
            )
            result = raw if isinstance(raw, list) else [raw]
            thought_steps.append({
                "node": "Analytics",
                "action": "mcp_kpi",
                "detail": f"KPI={acronym}, rows={len(result)} (via MCP run_kpi_query)",
            })
        except Exception as e:
            thought_steps.append({
                "node": "Analytics",
                "action": "mcp_fallback",
                "detail": f"MCP failed ({e}), falling back to direct SQL",
            })

    if result is None:
        import yaml
        cfg_path = pathlib.Path(__file__).parents[1] / "config" / "metric_registry.yaml"
        with open(cfg_path) as f:
            registry = yaml.safe_load(f)["metrics"]
        kpi = registry.get(acronym, {})
        source = kpi.get("view") or kpi.get("table")
        if not source:
            return Command(
                update={**state, "error": f"KPI {acronym} has no view/table", "thought_steps": thought_steps},
                goto="narrate",
            )
        sql = f"SELECT * FROM {source}"
        result, error = _execute_sql(sql)
        thought_steps.append({
            "node": "Analytics",
            "action": "direct_sql",
            "detail": f"KPI={acronym}, source={source}, rows={len(result) if result else 0}",
        })

    # Check thresholds — route to HITL if alert found
    if "check_thresholds" in tools:
        try:
            alerts_raw = await tools["check_thresholds"].ainvoke(
                {"client_id": state.get("client_id", "CLIENT_1")}
            )
            alerts = alerts_raw if isinstance(alerts_raw, list) else [alerts_raw]
            real_alerts = [a for a in alerts if a.get("status") == "ALERT"]
            if real_alerts:
                alert = real_alerts[0]
                thought_steps.append({
                    "node": "Analytics",
                    "action": "threshold_alert",
                    "detail": f"Alert: {alert.get('kpi')} {alert.get('workspace')} = {alert.get('value')}",
                })
                return Command(
                    update={
                        **state,
                        "sql": sql,
                        "result": result,
                        "error": error,
                        "thought_steps": thought_steps,
                        "hitl_pending": True,
                        "hitl_payload": alert,
                    },
                    goto="hitl",
                )
        except Exception:
            pass

    return Command(
        update={**state, "sql": sql, "result": result, "error": error, "thought_steps": thought_steps},
        goto="narrate",
    )


# ── Text2SQL node (ad-hoc path) ───────────────────────────────────────────────

def text2sql_node(state: AgentState) -> AgentState:
    """
    Ad-hoc query path — full SQL-of-Thought pipeline:
    schema_link → query_plan → sql_gen → guardrails → correction_loop

    Uses structured output (SchemaLink, QueryPlan, GeneratedSQL) from updated modules.
    Passes initial_violations to correction_loop when guardrails fire.
    """
    query = state.get("query", "")
    history = state.get("history", [])
    thought_steps = list(state.get("thought_steps", []))

    # Build history context (last 3 turns) for richer schema linking
    history_context = ""
    if history:
        recent = history[-3:]
        history_context = (
            "Prior conversation:\n"
            + "\n".join(f"Q: {h['query']}\nA: {h.get('answer', '')[:120]}" for h in recent)
            + "\n\nCurrent question:"
        )
    contextual_query = f"{history_context} {query}" if history_context else query

    # Step 1: Schema linking → SchemaLink
    schema_link: SchemaLink = link_schema(contextual_query)
    thought_steps.append({
        "node": "Text2SQL",
        "action": "schema_link",
        "detail": (
            f"Linked columns: {list(schema_link.columns.keys())}"
            + (f", filter_values: {schema_link.filter_values}" if schema_link.filter_values else "")
            + (f", time_window: {schema_link.time_window_hint}" if schema_link.time_window_hint else "")
        ),
    })

    # Step 2: Query planning → QueryPlan
    query_plan: QueryPlan = plan_query(query, schema_link)
    thought_steps.append({
        "node": "Text2SQL",
        "action": "query_plan",
        "detail": (
            f"strategy={query_plan.aggregation_strategy}, "
            f"join={query_plan.requires_join}, "
            f"tables={query_plan.tables_used}, "
            f"steps={len(query_plan.steps)}"
        ),
    })

    # Step 3: SQL generation → GeneratedSQL
    generated: GeneratedSQL = generate_sql(query, query_plan)
    thought_steps.append({
        "node": "Text2SQL",
        "action": "sql_gen",
        "detail": (
            f"confidence={generated.confidence:.2f}"
            + (f", warnings={generated.warnings}" if generated.warnings else "")
            + f", sql_len={len(generated.sql)}"
        ),
    })

    sql = generated.sql

    # Step 4: Guardrails — structured check
    guardrail_result: GuardrailResult = check_all(sql)
    initial_violations = None

    if not guardrail_result.safe:
        initial_violations = guardrail_result.violations
        violation_details = [
            f"{v.category}/{v.code}: {v.message}" for v in guardrail_result.violations
        ]
        thought_steps.append({
            "node": "Text2SQL",
            "action": "guardrails_fail",
            "detail": f"primary={guardrail_result.primary_category}, violations={violation_details}",
        })

        # Hard fail on syntax/DDL violations — don't attempt correction
        if guardrail_result.primary_category in ("syntax",):
            return {
                **state,
                "sql": sql,
                "error": f"Guardrails blocked: {violation_details}",
                "thought_steps": thought_steps,
            }
    else:
        thought_steps.append({
            "node": "Text2SQL",
            "action": "guardrails_pass",
            "detail": f"All checks passed (primary_category=None)",
        })

    # Step 5: Correction loop — taxonomy-driven, returns 4-tuple
    final_sql, result, error, correction_log = run_correction_loop(
        query, sql, _execute_sql, initial_violations=initial_violations
    )

    if correction_log:
        thought_steps.append({
            "node": "Text2SQL",
            "action": "correction_loop",
            "detail": " | ".join(correction_log),
        })

    thought_steps.append({
        "node": "Text2SQL",
        "action": "execute",
        "detail": f"final_sql_len={len(final_sql)}, rows={len(result) if result else 0}, error={error}",
    })

    return {**state, "sql": final_sql, "result": result, "error": error, "thought_steps": thought_steps}


# ── HITL node ─────────────────────────────────────────────────────────────────

async def hitl_node(state: AgentState) -> AgentState:
    """
    Human-in-the-loop node — pauses graph execution for alert approval.
    Uses LangGraph v1 interrupt() — suspends until resumed with Command(resume=decision).

    The Agent Inbox item is embedded in the interrupt payload so the frontend
    can display it. Resume via POST /api/nlq/hitl/resume.
    """
    payload = state.get("hitl_payload") or {}
    thought_steps = list(state.get("thought_steps", []))

    inbox_item = {
        "id": f"hitl_{int(time.time() * 1000) % 10_000_000}",
        "type": "alert",
        "severity": "warning",
        "title": f"Alert Approval: {payload.get('kpi', 'Unknown KPI')}",
        "body": payload.get("message", "Alert ready to fire. Approve or reject."),
        "requires_action": True,
        "time": "just now",
        "read": False,
    }

    thought_steps.append({
        "node": "HITL",
        "action": "interrupt",
        "detail": f"Pausing for human approval: {payload.get('kpi')} {payload.get('workspace')}",
    })

    # interrupt() suspends the graph; decision = what was passed to Command(resume=...)
    decision = interrupt({"payload": payload, "inbox_item": inbox_item})

    thought_steps.append({
        "node": "HITL",
        "action": "resume",
        "detail": f"Decision: {decision}",
    })

    return {
        **state,
        "hitl_decision": decision,
        "hitl_pending": False,
        "pending_inbox_items": [inbox_item],
        "thought_steps": thought_steps,
    }


# ── Fire alert action node ────────────────────────────────────────────────────

async def fire_alert_action_node(state: AgentState) -> AgentState:
    """
    Fires alert via MCP fire_alert tool if HITL decision was 'approve'.
    Silently skips if 'reject' or tool unavailable.
    """
    decision = state.get("hitl_decision", "reject")
    thought_steps = list(state.get("thought_steps", []))

    if decision == "approve":
        tools = await _init_mcp()
        if "fire_alert" in tools:
            payload = state.get("hitl_payload") or {}
            try:
                fire_result = await tools["fire_alert"].ainvoke({"alert": payload})
                thought_steps.append({
                    "node": "FireAlert",
                    "action": "dispatched",
                    "detail": str(fire_result)[:120],
                })
            except Exception as e:
                thought_steps.append({
                    "node": "FireAlert",
                    "action": "error",
                    "detail": str(e),
                })
        else:
            thought_steps.append({
                "node": "FireAlert",
                "action": "skip",
                "detail": "fire_alert tool not available",
            })
    else:
        thought_steps.append({
            "node": "FireAlert",
            "action": "rejected",
            "detail": "Alert rejected by human — not fired",
        })

    return {**state, "thought_steps": thought_steps}


# ── Narrate node ───────────────────────────────────────────────────────────────

def narrate_node(state: AgentState) -> AgentState:
    """
    Generate plain-English insight narrative via Vertex AI LLM.
    Infers chart spec from result shape.
    Appends this turn to history (capped at 20 turns).
    Handles context-aware queries (page/chart context, no SQL needed).
    """
    query = state.get("query", "")
    result = state.get("result")
    error = state.get("error")
    sql = state.get("sql", "")
    thought_steps = list(state.get("thought_steps", []))
    history = list(state.get("history", []))
    page_context = state.get("page_context")
    chart_context = state.get("chart_context")
    web_search_results = state.get("web_search_results")

    # KPI definition path (set by router via _kpi_definition field)
    pre_narrative = state.get("_kpi_definition")
    if pre_narrative and not result and not error:
        thought_steps.append({
            "node": "Narrate",
            "action": "passthrough",
            "detail": "narrative pre-set by router",
        })
        history.append({"query": query, "answer": pre_narrative, "sql": ""})
        return {
            **state,
            "narrative": pre_narrative,
            "thought_steps": thought_steps,
            "history": history[-20:],
        }

    # Context-aware path: answer based on page/chart context (no SQL result needed)
    if state.get("intent") == "context_aware" and not result:
        narrative = _generate_context_narrative(
            query, page_context, chart_context, web_search_results, history
        )
        thought_steps.append({
            "node": "Narrate",
            "action": "context_narrate",
            "detail": f"narrative_len={len(narrative)}, context_based=True",
        })
        history.append({"query": query, "answer": narrative, "sql": ""})
        return {
            **state,
            "narrative": narrative,
            "thought_steps": thought_steps,
            "history": history[-20:],
        }

    if error and not result:
        narrative = f"I was unable to answer that question. Error: {error}"
        history.append({"query": query, "answer": narrative, "sql": sql or ""})
        return {
            **state,
            "narrative": narrative,
            "thought_steps": thought_steps,
            "history": history[-20:],
        }

    if not result:
        narrative = "No data found for that query."
        history.append({"query": query, "answer": narrative, "sql": sql or ""})
        return {
            **state,
            "narrative": narrative,
            "thought_steps": thought_steps,
            "history": history[-20:],
        }

    chart_spec = _infer_chart_spec(result, sql)
    narrative = _generate_narrative(
        query, result, sql, history=history,
        page_context=page_context,
        chart_context=chart_context,
        web_search_results=web_search_results,
    )

    thought_steps.append({
        "node": "Narrate",
        "action": "narrate",
        "detail": f"narrative_len={len(narrative)}, chart_type={chart_spec.get('type', 'none')}",
    })

    history.append({"query": query, "answer": narrative, "sql": sql or ""})
    return {
        **state,
        "narrative": narrative,
        "chart_spec": chart_spec,
        "thought_steps": thought_steps,
        "history": history[-20:],
    }


def _generate_context_narrative(
    query: str,
    page_context: dict | None,
    chart_context: dict | None,
    web_search_results: str | None,
    history: list[dict] | None = None,
) -> str:
    """Generate narrative from page/chart context without SQL query results."""
    try:
        from api.llm import complete

        history_context = ""
        if history:
            recent = history[-2:]
            history_context = "\nPrevious context:\n" + "\n".join(
                f"Q: {h['query']}\nA: {h.get('answer', '')[:200]}" for h in recent
            ) + "\n"

        page_text = ""
        if page_context:
            page_text = (
                f"\nThe user is viewing the {page_context.get('page', 'unknown')} page.\n"
                f"Active filters: {json.dumps(page_context.get('filters', {}), default=str)}\n"
                f"Visible KPIs: {json.dumps(page_context.get('kpis', []), default=str)}\n"
                f"Visible headings: {page_context.get('visible_elements', {}).get('headings', [])}\n"
            )

        chart_text = ""
        if chart_context:
            if chart_context.get("data"):
                chart_text = (
                    f"\nChart title: {chart_context.get('title', 'Unknown')}\n"
                    f"Chart data (first 10 rows): {json.dumps(chart_context['data'][:10], default=str)}\n"
                )
            elif chart_context.get("image_base64"):
                chart_text = "\nA chart image was provided for analysis.\n"

        web_text = ""
        if web_search_results:
            web_text = f"\nWeb search context:\n{web_search_results}\n"

        prompt = (
            f"{_NARRATE_SYSTEM_RULES}\n"
            f"Question: {query}\n"
            f"{history_context}"
            f"{page_text}"
            f"{chart_text}"
            f"{web_text}"
            "\nAnswer the user's question based on the visible dashboard context. "
            "Be specific and concise. No preamble."
        )
        return complete(prompt, max_tokens=256)
    except Exception as e:
        ctx = page_context.get("page", "dashboard") if page_context else "dashboard"
        return f"You're viewing the {ctx} page. (Context narrative error: {e})"


def _infer_chart_spec(result: list[dict], sql: str) -> dict:
    if not result:
        return {"type": "none"}
    first = result[0]
    keys = list(first.keys())
    if len(result) > 1 and len(keys) >= 2:
        x_key = keys[0]
        y_keys = [k for k in keys[1:] if isinstance(first.get(k), (int, float))]
        if y_keys:
            return {"type": "bar", "x": x_key, "y": y_keys, "data": result[:50]}
    return {"type": "table", "data": result[:50]}


_NARRATE_SYSTEM_RULES = (
    "You are a MediaFlow AI analytics assistant that helps users understand their media operations data.\n"
    "NEVER reveal internal implementation details (technology, architecture, database).\n"
    "NEVER mention DuckDB, LangChain, LangGraph, Vertex AI, Gemini, Python, pandas, numpy, "
    "FastAPI, FastMCP, BigQuery, ChromaDB, uvicorn, or any internal technology names.\n"
    "If asked how you work, respond: 'I am a MediaFlow AI analytics assistant that helps you "
    "understand your media operations data.'\n"
    "Be specific with numbers. Write concise insights in plain English.\n"
)


def _generate_narrative(
    query: str,
    result: list[dict],
    sql: str,
    history: list[dict] | None = None,
    page_context: dict | None = None,
    chart_context: dict | None = None,
    web_search_results: str | None = None,
) -> str:
    try:
        from api.llm import complete

        sample = json.dumps(result[:5], default=str)
        history_context = ""
        if history:
            recent = history[-2:]
            history_context = "\nPrevious context:\n" + "\n".join(
                f"Q: {h['query']}\nA: {h.get('answer', '')[:200]}" for h in recent
            ) + "\n"

        page_ctx_text = ""
        if page_context:
            page_ctx_text = (
                f"\nThe user is viewing the {page_context.get('page', 'unknown')} page. "
                f"Active filters: {page_context.get('filters', {})}. "
                f"Visible KPIs: {page_context.get('kpis', [])}. "
                "Use this context to give relevant answers.\n"
            )

        chart_ctx_text = ""
        if chart_context:
            if chart_context.get("data"):
                chart_ctx_text = (
                    f"\nChart data provided: {json.dumps(chart_context['data'][:10], default=str)}\n"
                    f"Chart title: {chart_context.get('title', 'Unknown')}\n"
                )

        web_ctx_text = ""
        if web_search_results:
            web_ctx_text = f"\nWeb search results for additional context:\n{web_search_results}\n"

        prompt = (
            f"{_NARRATE_SYSTEM_RULES}\n"
            f"Question: {query}\n"
            f"{history_context}"
            f"{page_ctx_text}"
            f"{chart_ctx_text}"
            f"{web_ctx_text}"
            f"Data sample (first 5 rows):\n{sample}\n"
            f"Total rows: {len(result)}\n\n"
            "Write a 1-2 sentence insight in plain English. "
            "Be specific with numbers. No preamble."
        )
        return complete(prompt, max_tokens=256)
    except Exception as e:
        return f"Found {len(result)} result(s). (Narrative error: {e})"


# ── Graph assembly ─────────────────────────────────────────────────────────────

def _build_graph() -> StateGraph:
    builder = StateGraph(AgentState)

    builder.add_node("input_guardrail", input_guardrail_node)
    builder.add_node("router", router_node)
    builder.add_node("analytics", analytics_node)
    builder.add_node("text2sql", text2sql_node)
    builder.add_node("hitl", hitl_node)
    builder.add_node("fire_alert_action", fire_alert_action_node)
    builder.add_node("narrate", narrate_node)
    builder.add_node("output_guardrail", output_guardrail_node)

    # Entry: input_guardrail first (hard-block path → narrate via Command)
    builder.add_edge(START, "input_guardrail")

    # Normal path: input_guardrail → router (when no block)
    # Hard-block path uses Command(goto="narrate") from input_guardrail_node
    builder.add_edge("input_guardrail", "router")

    # Router uses Command → analytics, text2sql, or narrate (no static edge needed)

    # analytics uses Command → hitl or narrate (no static edge needed)

    # text2sql → narrate (static)
    builder.add_edge("text2sql", "narrate")

    # HITL flow: hitl → fire_alert_action → narrate
    builder.add_edge("hitl", "fire_alert_action")
    builder.add_edge("fire_alert_action", "narrate")

    # narrate → output_guardrail → END
    builder.add_edge("narrate", "output_guardrail")
    builder.add_edge("output_guardrail", END)

    return builder


_checkpointer = InMemorySaver()
_graph = _build_graph().compile(checkpointer=_checkpointer, store=_store)


# ── SSE Streaming entry point ──────────────────────────────────────────────────

async def stream_qna_agent(
    query: str,
    session_id: str = "default",
    persona: str = "leadership",
    filters: dict | None = None,
    page_context: dict | None = None,
    chart_context: dict | None = None,
) -> AsyncGenerator[dict, None]:
    """
    Streaming entry point — yields SSE event dicts as nodes complete.

    Event types:
      thought_step  — one thought step from a node (shown live)
      sql_ready     — text2sql completed, SQL available
      final         — narrate completed, answer + chart_spec ready
      error         — unhandled exception
    """
    await _init_mcp()

    input_state: AgentState = {
        "session_id": session_id,
        "persona": persona,
        "client_id": "CLIENT_1",
        "query": query,
        "filters": filters or {},
        "thought_steps": [],
        "page_context": page_context,
        "chart_context": chart_context,
    }
    config = {"configurable": {"thread_id": session_id}}

    emitted_steps = 0

    try:
        async for chunk in _graph.astream(input_state, config=config, stream_mode="updates"):
            for node_name, update in chunk.items():
                if not isinstance(update, dict):
                    continue

                # Emit new thought steps
                all_steps = update.get("thought_steps", [])
                new_steps = all_steps[emitted_steps:]
                for step in new_steps:
                    yield {"type": "thought_step", "node": node_name, "data": step}
                emitted_steps = len(all_steps)

                # Emit SQL when text2sql finishes
                if node_name == "text2sql" and update.get("sql"):
                    yield {"type": "sql_ready", "data": update["sql"]}

                # Emit final when output_guardrail finishes (narrative is post-sanitized)
                if node_name == "output_guardrail" and update.get("narrative"):
                    yield {
                        "type": "final",
                        "answer": update["narrative"],
                        "sql": update.get("sql"),
                        "chart_spec": update.get("chart_spec"),
                        "thought_steps": update.get("thought_steps", []),
                    }
    except Exception as e:
        yield {"type": "error", "message": str(e)}


# ── Public entry point (blocking) ─────────────────────────────────────────────

async def run_qna_agent(
    query: str,
    session_id: str = "default",
    persona: str = "leadership",
    filters: dict | None = None,
    page_context: dict | None = None,
    chart_context: dict | None = None,
) -> dict[str, Any]:
    """
    Main entry point — called by POST /api/nlq endpoint.
    Uses ainvoke (blocking until graph completes).

    Multi-turn memory: InMemorySaver checkpointer preserves state.history per session_id.
    Long-term memory: InMemoryStore tracks query intents under ("mediaflow", session_id).
    """
    await _init_mcp()

    input_state: AgentState = {
        "session_id": session_id,
        "persona": persona,
        "client_id": "CLIENT_1",
        "query": query,
        "filters": filters or {},
        "thought_steps": [],
        "page_context": page_context,
        "chart_context": chart_context,
    }
    config = {"configurable": {"thread_id": session_id}}
    return await _graph.ainvoke(input_state, config=config)


async def get_mcp_tools() -> dict[str, Any]:
    """Expose MCP tool registry for external use (e.g., alert monitoring, report generation)."""
    return await _init_mcp()
