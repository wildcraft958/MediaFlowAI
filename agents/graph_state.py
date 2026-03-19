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
    history: list[dict]         # multi-turn memory
    error: Optional[str]
