"""LangGraph state schema for the QnA agent."""
from __future__ import annotations
from typing import Annotated, Any, Optional
from typing_extensions import TypedDict


def _last_value(a, b):
    """Reducer: last writer wins (allows multiple nodes to set the same key)."""
    return b if b is not None else a


class AgentState(TypedDict, total=False):
    session_id: str
    persona: str            # cxo | manager | analyst
    client_id: str          # CLIENT_1
    query: str              # user's NL query
    intent: str             # standard_kpi | ad_hoc
    filters: dict[str, Any]
    sql: Annotated[Optional[str], _last_value]
    result: Annotated[Optional[list[dict]], _last_value]
    chart_spec: Annotated[Optional[dict], _last_value]
    narrative: Annotated[Optional[str], _last_value]
    thought_steps: Annotated[list[dict], _last_value]   # [{node, action, detail}]
    history: Annotated[list[dict], _last_value]         # multi-turn memory [{query, answer, sql}]
    error: Annotated[Optional[str], _last_value]
    _matched_acronym: Optional[str]  # set by Router, consumed by Analytics
    _kpi_definition: Optional[str]   # set by Router for KPI definition queries

    # HITL fields
    hitl_pending: bool
    hitl_payload: Optional[dict]    # alert dict awaiting approval
    hitl_decision: Optional[str]    # "approve"|"reject" - set on resume
    pending_inbox_items: list[dict] # items pushed to Agent Inbox this turn

    # Context-aware copilot fields
    page_context: Optional[dict]       # {page, filters, kpis, chart_titles}
    chart_context: Optional[dict]      # {title, data, image_base64}
    web_search_results: Optional[str]

    # Guardrail tracking fields (WS-8D)
    input_guardrail_violations: list[str]   # e.g. ["pii:email_redacted"]
    output_guardrail_violations: list[str]
    pii_redacted: bool                      # True if query was sanitized
