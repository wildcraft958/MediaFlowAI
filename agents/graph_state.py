"""LangGraph state schema for the QnA agent."""
from __future__ import annotations
from typing import Any, Optional
from typing_extensions import TypedDict


class AgentState(TypedDict, total=False):
    session_id: str
    persona: str            # leadership | creator
    client_id: str          # CLIENT_1
    query: str              # user's NL query
    intent: str             # standard_kpi | ad_hoc
    filters: dict[str, Any]
    sql: Optional[str]
    result: Optional[list[dict]]
    chart_spec: Optional[dict]
    narrative: Optional[str]
    thought_steps: list[dict]   # [{node, action, detail}]
    history: list[dict]         # multi-turn memory [{query, answer, sql}]
    error: Optional[str]
    _matched_acronym: Optional[str]  # set by Router, consumed by Analytics
    _kpi_definition: Optional[str]   # set by Router for KPI definition queries

    # HITL fields — set when alert needs human approval
    hitl_pending: bool
    hitl_payload: Optional[dict]    # alert dict awaiting approval
    hitl_decision: Optional[str]    # "approve"|"reject" — set on resume
    pending_inbox_items: list[dict] # items pushed to Agent Inbox this turn

    # Context-aware copilot fields
    page_context: Optional[dict]       # {page, filters, kpis, chart_titles}
    chart_context: Optional[dict]      # {title, data, image_base64}
    web_search_results: Optional[str]

    # Guardrail tracking fields (WS-8D)
    input_guardrail_violations: list[str]   # e.g. ["pii:email_redacted"]
    output_guardrail_violations: list[str]
    pii_redacted: bool                      # True if query was sanitized
