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

def input_guardrail_node(state: AgentState) -> AgentState:
    """
    First node in the graph. Validates/sanitizes the inbound query.
    On hard block (out-of-scope, sensitive content): sets 'error' and 'narrative'
    in state. The conditional edge routes to 'narrate' when error is set.
    """
    return _input_guardrail.before_agent(state)


def output_guardrail_node(state: AgentState) -> AgentState:
    """
    Last node before END. Redacts PII from narrative output, ensures non-empty response.
    """
    return _output_guardrail.after_agent(state)


# ── Router node ────────────────────────────────────────────────────────────────

# ── Unified LLM query classifier ─────────────────────────────────────────────
# Single LLM call handles ALL semantic routing: off-topic detection, KPI
# definitions, context-aware queries, and KPI vs ad-hoc classification.
# This replaces:
#   - middleware._is_relevant_query() LLM call  (redundant, removed)
#   - _try_kpi_definition() LLM call            (folded in)
#   - _CONTEXT_QUERY_SIGNALS regex              (brittle, removed)
#   - vector similarity search                  (fallback only)

_UNIFIED_CLASSIFY_SYSTEM = (
    "You are the query router for MediaFlow AI, a media analytics dashboard.\n"
    "The dashboard tracks: video uploads, processing, publishing across 5 workspaces.\n\n"
    "Available KPIs: PCR, FSC, GR, CRM, TEU, AIL, SAC, AHY, EDR, HTHR, "
    "TSQI, PIG, AGV, PMI, MCI, DCDR, CPDG, ZSP, LPI.\n\n"
    "Classify the user query into EXACTLY one category:\n\n"
    "OFF_TOPIC — Query has nothing to do with media analytics, dashboards, video content, "
    "KPIs, workspaces, teams, or data (e.g., recipes, weather, coding help, personal advice, "
    "general knowledge questions unrelated to media/analytics).\n\n"
    "KPI_DEF:<ACRONYM> — User asks what a SPECIFIC KPI means/is/stands for "
    "(e.g., 'What is PCR?', 'Define CPDG', 'Explain LPI').\n\n"
    "GENERAL_KPI — User asks about KPIs in general, what metrics exist, or wants an overview "
    "(e.g., 'What KPIs do you track?', 'What is KPIs?', 'Explain the metrics here').\n\n"
    "CONTEXT_AWARE — User references what's currently visible on screen, a chart, or the page "
    "(e.g., 'Explain this chart', 'What does this show?', 'Summarize this page', "
    "'What am I looking at?', 'Break down the data above', 'Analyze what I see'). "
    "This requires page/chart context to answer.\n\n"
    "STANDARD_KPI:<ACRONYM> — User asks a data question that maps to a known KPI "
    "(e.g., 'PCR by workspace' → STANDARD_KPI:PCR, 'Show upload trends' → STANDARD_KPI:TEU, "
    "'Which workspace publishes most?' → STANDARD_KPI:PCR).\n\n"
    "AD_HOC — Any other analytics question that needs a custom SQL query "
    "(e.g., 'Top 5 videos by duration', 'Compare Hindi vs English output', "
    "'How many videos were uploaded last week?').\n\n"
    "Respond with ONLY the classification label. Nothing else."
)


def _classify_query(query: str, has_context: bool) -> str:
    """
    Single LLM call to classify query intent. Returns one of:
    OFF_TOPIC, KPI_DEF:<ACRONYM>, GENERAL_KPI, CONTEXT_AWARE,
    STANDARD_KPI:<ACRONYM>, AD_HOC.

    Falls back to AD_HOC on LLM failure (fail-open for data queries).
    """
    try:
        from api.llm import complete

        context_hint = ""
        if has_context:
            context_hint = "\n[NOTE: The user has page/chart context available.]\n"

        result = complete(
            prompt=f"User query: {query}{context_hint}",
            system=_UNIFIED_CLASSIFY_SYSTEM,
            temperature=0.0,
            max_tokens=30,
        ).strip().upper()

        # Validate the response is a known category
        if result in ("OFF_TOPIC", "GENERAL_KPI", "CONTEXT_AWARE", "AD_HOC"):
            return result
        if result.startswith("KPI_DEF:") or result.startswith("STANDARD_KPI:"):
            return result

        # LLM returned something unexpected — fall back to AD_HOC
        return "AD_HOC"
    except Exception:
        return "AD_HOC"


def _build_kpi_definition(acronym: str) -> Optional[str]:
    """Build a KPI definition narrative for a specific acronym."""
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


def _build_general_kpi_summary() -> str:
    """Build a summary of all tracked KPIs."""
    try:
        from api.config import METRIC_REGISTRY
        kpi_list = []
        for acr, kpi in METRIC_REGISTRY.items():
            kpi_list.append(f"- **{kpi['name']}** ({acr}): {kpi.get('description', '')[:80]}")
        summary = "\n".join(kpi_list[:19])
        return (
            "**Key Performance Indicators (KPIs)** tracked in this dashboard:\n\n"
            f"{summary}\n\n"
            "Ask about any specific KPI for more details (e.g., 'What is PCR?')."
        )
    except Exception:
        return "This dashboard tracks 19 KPIs across uploads, processing, and publishing."


def router_node(
    state: AgentState, *, store: BaseStore
) -> Command[Literal["analytics", "text2sql", "narrate"]]:
    """
    Unified query classifier and router — single LLM call for ALL semantic routing.

    One call to _classify_query() determines:
      OFF_TOPIC        → narrate with off-topic message
      KPI_DEF:<acr>    → narrate with KPI definition
      GENERAL_KPI      → narrate with KPI summary
      CONTEXT_AWARE    → narrate with context-based answer
      STANDARD_KPI:<a> → analytics node
      AD_HOC           → text2sql node

    Vector similarity search used as fallback refinement for STANDARD_KPI
    when the LLM doesn't specify an acronym, and to distinguish STANDARD_KPI
    vs AD_HOC when the LLM returns AD_HOC but a strong KPI match exists.

    Uses Command (LangGraph v1) to combine state update + routing in one step.
    Also reads/writes long-term store to track query patterns across sessions.
    """
    query = state.get("query", "")
    session_id = state.get("session_id", "default")
    has_context = bool(state.get("page_context") or state.get("chart_context"))

    namespace = ("mediaflow", session_id)
    try:
        prior_items = store.search(namespace)
        prior_intents = [m.value.get("intent") for m in prior_items if m.value.get("intent")]
    except Exception:
        prior_intents = []

    thought_steps: list[dict] = []

    # ── Parallel: LLM classification + vector search run concurrently ────────
    # Both are independent lookups on the same query. Running in parallel
    # saves 100-300ms vs sequential (vector search only used as fallback).
    from concurrent.futures import ThreadPoolExecutor, as_completed

    def _do_vector_search():
        try:
            from agents.vector_store import query_kpi_similarity
            matches = query_kpi_similarity(query, n_results=1)
            if matches and matches[0]["score"] >= _SIMILARITY_THRESHOLD:
                return matches[0]
        except Exception:
            pass
        return None

    with ThreadPoolExecutor(max_workers=2) as pool:
        classify_future = pool.submit(_classify_query, query, has_context)
        vector_future = pool.submit(_do_vector_search)
        classification = classify_future.result()
        vector_match = vector_future.result()

    thought_steps.append({
        "node": "Router",
        "action": "classify",
        "detail": f"unified_llm → {classification}" + (f", vector → {vector_match['acronym']}({vector_match['score']:.3f})" if vector_match else ""),
    })

    # Helper: write to long-term store
    def _store_intent(intent: str):
        try:
            store.put(namespace, f"q_{int(time.time() * 1000) % 10_000_000}", {
                "query": query[:120],
                "intent": intent,
            })
        except Exception:
            pass

    # Helper: base state update dict (clears stale fields)
    def _base_update(**overrides):
        base = {
            "thought_steps": thought_steps,
            "_matched_acronym": None,
            "_kpi_definition": None,
            "error": None,
            "result": None,
            "sql": None,
            "narrative": None,
            "chart_spec": None,
            "hitl_pending": False,
            "hitl_payload": None,
            "hitl_decision": None,
            "pending_inbox_items": [],
        }
        base.update(overrides)
        return base

    # ── OFF_TOPIC → block with user-friendly narrative ───────────────────────
    if classification == "OFF_TOPIC":
        from agents.middleware import _OFF_TOPIC_NARRATIVE
        _store_intent("off_topic")
        return Command(
            update=_base_update(
                intent="off_topic",
                error="Query blocked: off-topic.",
                narrative=_OFF_TOPIC_NARRATIVE,
            ),
            goto="narrate",
        )

    # ── KPI_DEF:<ACRONYM> → specific KPI definition ─────────────────────────
    if classification.startswith("KPI_DEF:"):
        acronym = classification.split(":")[1].strip()
        kpi_def = _build_kpi_definition(acronym)
        if kpi_def:
            _store_intent("kpi_definition")
            return Command(
                update=_base_update(
                    intent="kpi_definition",
                    _kpi_definition=kpi_def,
                ),
                goto="narrate",
            )
        # Acronym not found in registry — fall through to AD_HOC
        thought_steps.append({
            "node": "Router",
            "action": "fallback",
            "detail": f"KPI {acronym} not in registry, falling through to ad_hoc",
        })

    # ── GENERAL_KPI → overview of all KPIs ───────────────────────────────────
    if classification == "GENERAL_KPI":
        _store_intent("kpi_definition")
        return Command(
            update=_base_update(
                intent="kpi_definition",
                _kpi_definition=_build_general_kpi_summary(),
            ),
            goto="narrate",
        )

    # ── CONTEXT_AWARE → narrate from page/chart context ──────────────────────
    if classification == "CONTEXT_AWARE":
        _store_intent("context_aware")
        return Command(
            update=_base_update(intent="context_aware"),
            goto="narrate",
        )

    # ── STANDARD_KPI:<ACRONYM> → analytics node ─────────────────────────────
    matched_acronym: Optional[str] = None
    if classification.startswith("STANDARD_KPI:"):
        acronym = classification.split(":")[1].strip()
        try:
            from api.config import METRIC_REGISTRY
            if acronym in METRIC_REGISTRY:
                matched_acronym = acronym
        except Exception:
            pass

    # ── Fallback: use pre-computed vector search result (ran in parallel above)
    if not matched_acronym and vector_match:
        matched_acronym = vector_match["acronym"]
        thought_steps.append({
            "node": "Router",
            "action": "vector_refine",
            "detail": f"vector fallback: {matched_acronym} (score={vector_match['score']:.3f})",
        })

    # ── Route to analytics or text2sql ───────────────────────────────────────
    if matched_acronym:
        intent = "standard_kpi"
        _store_intent(intent)
        return Command(
            update=_base_update(intent=intent, _matched_acronym=matched_acronym),
            goto="analytics",
        )

    intent = "ad_hoc"
    hint = f" (prior: {prior_intents[-3:]})" if prior_intents else ""
    thought_steps.append({
        "node": "Router",
        "action": "route",
        "detail": f"ad_hoc{hint}",
    })
    _store_intent(intent)
    return Command(
        update=_base_update(intent=intent),
        goto="text2sql",
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

    # ── Run KPI query + threshold check in parallel (both are independent MCP calls)
    import asyncio

    async def _run_kpi():
        if "run_kpi_query" not in tools:
            return None, None
        try:
            raw = await tools["run_kpi_query"].ainvoke(
                {"kpi_name": acronym, "filters": state.get("filters", {})}
            )
            return (raw if isinstance(raw, list) else [raw]), None
        except Exception as e:
            return None, str(e)

    async def _check_alerts():
        if "check_thresholds" not in tools:
            return []
        try:
            alerts_raw = await tools["check_thresholds"].ainvoke(
                {"client_id": state.get("client_id", "CLIENT_1")}
            )
            alerts = alerts_raw if isinstance(alerts_raw, list) else [alerts_raw]
            return [a for a in alerts if a.get("status") == "ALERT"]
        except Exception:
            return []

    (kpi_result, kpi_error), real_alerts = await asyncio.gather(
        _run_kpi(), _check_alerts()
    )

    if kpi_result is not None:
        result = kpi_result
        thought_steps.append({
            "node": "Analytics",
            "action": "mcp_kpi",
            "detail": f"KPI={acronym}, rows={len(result)} (via MCP run_kpi_query)",
        })
    elif kpi_error:
        thought_steps.append({
            "node": "Analytics",
            "action": "mcp_fallback",
            "detail": f"MCP failed ({kpi_error}), falling back to direct SQL",
        })

    # Direct SQL fallback if MCP failed
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

    # Check threshold results (already computed in parallel)
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

    # Pre-set narrative path: guardrail or earlier node already set a user-friendly
    # narrative (e.g., off-topic block, sensitive content block). Respect it.
    existing_narrative = state.get("narrative")
    if existing_narrative and error and not result:
        thought_steps.append({
            "node": "Narrate",
            "action": "passthrough",
            "detail": "narrative pre-set by guardrail",
        })
        history.append({"query": query, "answer": existing_narrative, "sql": sql or ""})
        return {
            **state,
            "narrative": existing_narrative,
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

    narrative, chart_spec = _generate_narrative_and_chart(
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


## _infer_chart_spec removed — chart type is now decided by LLM in _generate_narrative_and_chart()
## _infer_chart_spec_heuristic() is the fallback when LLM chart selection fails.


_NARRATE_SYSTEM_RULES = (
    "You are a MediaFlow AI analytics assistant that helps users understand their media operations data.\n"
    "NEVER reveal internal implementation details (technology, architecture, database).\n"
    "NEVER mention DuckDB, LangChain, LangGraph, Vertex AI, Gemini, Python, pandas, numpy, "
    "FastAPI, FastMCP, BigQuery, ChromaDB, uvicorn, or any internal technology names.\n"
    "If asked how you work, respond: 'I am a MediaFlow AI analytics assistant that helps you "
    "understand your media operations data.'\n"
    "Be specific with numbers. Write concise insights in plain English.\n"
)


def _generate_narrative_and_chart(
    query: str,
    result: list[dict],
    sql: str,
    history: list[dict] | None = None,
    page_context: dict | None = None,
    chart_context: dict | None = None,
    web_search_results: str | None = None,
) -> tuple[str, dict]:
    """
    Single LLM call that returns both the narrative insight AND the best chart type.
    Returns (narrative_text, chart_spec_dict).
    """
    # Prepare data for the LLM
    data = result
    # Unwrap MCP tool response format
    if len(data) == 1 and isinstance(data[0], dict) and data[0].get("type") == "text":
        try:
            parsed = json.loads(data[0]["text"])
            if isinstance(parsed, list):
                data = parsed
        except (json.JSONDecodeError, KeyError):
            pass

    first = data[0] if data else {}
    all_keys = [k for k in first.keys() if not k.startswith("__")]

    try:
        from api.llm import complete

        sample = json.dumps(data[:5], default=str)
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
            f"Data columns: {all_keys}\n"
            f"Data sample (first 5 rows):\n{sample}\n"
            f"Total rows: {len(data)}\n\n"
            "Respond in EXACTLY this format (two sections separated by ---CHART---):\n\n"
            "1-2 sentence insight in plain English. Be specific with numbers. No preamble.\n"
            "---CHART---\n"
            "CHART_TYPE|X_COLUMN|Y_COLUMN\n\n"
            "CHART_TYPE must be one of:\n"
            "- number (single scalar result, 1 row — use the most important numeric column as Y)\n"
            "- donut (categorical breakdown with 2-7 categories — good for distributions, shares, counts by category)\n"
            "- line (time-series or sequential data with 7+ data points — good for trends over time)\n"
            "- scatter (two numeric dimensions, 5+ points — good for correlations)\n"
            "- bar (categorical comparison — good for ranking, comparing across groups)\n"
            "- table (complex/wide data that doesn't fit other types)\n\n"
            "X_COLUMN = the column name for the x-axis (category, date, or first numeric dimension)\n"
            "Y_COLUMN = the column name for the y-axis (the main numeric value to visualize)\n\n"
            "Example: bar|workspace|total_uploaded\n"
            "Example: donut|language|count\n"
            "Example: line|upload_date|uploaded\n"
            "Example: number||pcr_pct\n"
        )
        raw = complete(prompt, max_tokens=350)

        # Parse the response
        if "---CHART---" in raw:
            parts = raw.split("---CHART---", 1)
            narrative = parts[0].strip()
            chart_line = parts[1].strip().split("\n")[0].strip()
        else:
            # Fallback: treat entire response as narrative
            narrative = raw.strip()
            chart_line = ""

        # Parse chart spec from LLM response
        chart_spec = _parse_chart_line(chart_line, data)

        return narrative, chart_spec

    except Exception as e:
        # Fallback: return basic narrative + heuristic chart
        narrative = f"Found {len(data)} result(s). (Narrative error: {e})"
        chart_spec = _infer_chart_spec_heuristic(data, sql)
        return narrative, chart_spec


def _parse_chart_line(chart_line: str, data: list[dict]) -> dict:
    """Parse LLM chart recommendation like 'donut|workspace|total_uploaded' into a chart_spec."""
    if not chart_line or "|" not in chart_line:
        return _infer_chart_spec_heuristic(data, "")

    parts = [p.strip() for p in chart_line.split("|")]
    if len(parts) < 3:
        return _infer_chart_spec_heuristic(data, "")

    chart_type, x_col, y_col = parts[0].lower(), parts[1], parts[2]
    valid_types = {"number", "donut", "line", "scatter", "bar", "table"}
    if chart_type not in valid_types:
        chart_type = "bar"

    # Validate columns exist in data
    first = data[0] if data else {}
    all_keys = list(first.keys())
    if x_col and x_col not in all_keys:
        x_col = all_keys[0] if all_keys else ""
    if y_col and y_col not in all_keys:
        # Find first numeric column
        y_col = next((k for k in all_keys if isinstance(first.get(k), (int, float))), all_keys[-1] if all_keys else "")

    if chart_type == "number":
        val = first.get(y_col, 0) if first else 0
        return {"type": "number", "label": y_col.replace("_", " ").title(), "value": val, "data": data[:1]}
    elif chart_type == "donut":
        return {"type": "donut", "x": x_col, "y": y_col, "data": data[:10]}
    elif chart_type == "line":
        return {"type": "line", "x": x_col, "y": [y_col], "data": data[:100]}
    elif chart_type == "scatter":
        label_key = next((k for k in all_keys if isinstance(first.get(k), str)), None)
        return {"type": "scatter", "x": x_col, "y": y_col, "label": label_key, "data": data[:100]}
    elif chart_type == "table":
        return {"type": "table", "data": data[:50]}
    else:  # bar
        return {"type": "bar", "x": x_col, "y": [y_col], "data": data[:50]}


def _infer_chart_spec_heuristic(data: list[dict], sql: str) -> dict:
    """Heuristic fallback when LLM chart selection fails."""
    if not data:
        return {"type": "none"}
    first = data[0]
    keys = [k for k in first.keys() if not k.startswith("__")]
    str_keys = [k for k in keys if isinstance(first.get(k), str)]
    numeric_keys = [k for k in keys if isinstance(first.get(k), (int, float))]
    if str_keys and numeric_keys and len(data) > 1:
        return {"type": "bar", "x": str_keys[0], "y": numeric_keys[:3], "data": data[:50]}
    if numeric_keys and len(data) == 1:
        return {"type": "number", "label": numeric_keys[0].replace("_", " ").title(), "value": first[numeric_keys[0]], "data": data}
    return {"type": "table", "data": data[:50]}


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

    # Entry: input_guardrail first
    builder.add_edge(START, "input_guardrail")

    # Conditional routing from input_guardrail:
    #   - If blocked (error set) → narrate (via Command from node)
    #   - Normal flow → router
    # Using conditional_edges so the static edge doesn't conflict with Command routing.
    builder.add_conditional_edges(
        "input_guardrail",
        lambda state: "narrate" if state.get("error") else "router",
        {"narrate": "narrate", "router": "router"},
    )

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
