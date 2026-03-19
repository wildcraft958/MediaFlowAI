"""
MediaFlow AI agent middleware — input, output, and tool-call guardrails.

These classes follow the AgentMiddleware pattern (before_agent / after_agent /
wrap_tool_call hooks) but are invoked directly from LangGraph nodes rather than
via create_agent. This allows them to be:
  - Unit-tested directly (no graph needed)
  - Composed into StateGraph as input/output guard nodes
  - Extended or wrapped around future create_agent agents

DOs:
  - Return a new dict (state copy + updates) — never mutate state in-place
  - Keep checks synchronous (regex/dict lookups) — no I/O in hooks

Architecture note: LangGraph Command(goto="narrate") is used for hard blocks
so the pre-set narrative is picked up by narrate_node without re-generating.
"""
from __future__ import annotations
import re
from agents.graph_state import AgentState

# ── PII patterns ───────────────────────────────────────────────────────────────
_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
_PHONE_RE = re.compile(r"\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b")

# ── Injection patterns ─────────────────────────────────────────────────────────
_INJECTION_RE = re.compile(
    r"\b(ignore previous instructions?|disregard|you are now|pretend you are|"
    r"act as|jailbreak|DAN|do anything now)\b",
    re.IGNORECASE,
)

# ── Tech name leakage patterns ───────────────────────────────────────────────
_TECH_NAME_RE = re.compile(
    r"\b(DuckDB|LangChain|LangGraph|Vertex\s*AI|Gemini|FastMCP|BigQuery|"
    r"ChromaDB|FastAPI|uvicorn|Python|pandas|numpy)\b",
    re.IGNORECASE,
)

_TECH_REPLACEMENTS = {
    "duckdb": "our database",
    "langchain": "our AI system",
    "langgraph": "our AI system",
    "vertex ai": "our AI system",
    "vertexai": "our AI system",
    "gemini": "our AI system",
    "fastmcp": "our analytics engine",
    "bigquery": "our database",
    "chromadb": "our analytics engine",
    "fastapi": "our analytics engine",
    "uvicorn": "our analytics engine",
    "python": "our analytics engine",
    "pandas": "our analytics engine",
    "numpy": "our analytics engine",
}


def _redact_tech_names(text: str) -> str:
    """Replace technology names with generic terms."""
    def _replace(match):
        key = match.group(0).lower().strip()
        return _TECH_REPLACEMENTS.get(key, "our analytics engine")
    return _TECH_NAME_RE.sub(_replace, text)

# ── Out-of-scope hard-block patterns ─────────────────────────────────────────
_OUT_OF_SCOPE_RE = re.compile(
    r"\b(password|credit\s*card|ssn|social\s*security|bank\s*account|"
    r"delete\s+database|drop\s+table)\b",
    re.IGNORECASE,
)


class MediaFlowInputGuardrail:
    """
    Before-agent hook: validates and sanitizes inbound user query.
    Checks: PII detection/redaction, prompt injection, out-of-scope requests.

    Returns updated state dict. On hard block, sets 'error' and 'narrative'
    so the graph can jump straight to narrate.
    """

    def before_agent(self, state: AgentState) -> AgentState:
        return self._check(state)

    async def abefore_agent(self, state: AgentState) -> AgentState:
        return self._check(state)  # sync regex check is fine

    def _check(self, state: AgentState) -> AgentState:
        query = state.get("query", "")
        violations: list[str] = []
        sanitized = query

        # PII redaction
        if _EMAIL_RE.search(query):
            sanitized = _EMAIL_RE.sub("[EMAIL]", sanitized)
            violations.append("pii:email_redacted")
        if _PHONE_RE.search(sanitized):
            sanitized = _PHONE_RE.sub("[PHONE]", sanitized)
            violations.append("pii:phone_redacted")

        # Injection detection (flag but don't hard-block — let downstream decide)
        if _INJECTION_RE.search(query):
            violations.append("injection:prompt_injection_detected")

        # Out-of-scope patterns — hard block, return immediately
        if _OUT_OF_SCOPE_RE.search(query):
            return {
                **state,
                "error": "Query blocked: out-of-scope or sensitive content detected.",
                "narrative": "I can only answer questions about MediaFlow AI analytics data.",
                "input_guardrail_violations": violations + ["scope:blocked"],
                "pii_redacted": bool(violations),
            }

        return {
            **state,
            "query": sanitized,
            "input_guardrail_violations": violations,
            "pii_redacted": bool(violations),
        }


class MediaFlowOutputGuardrail:
    """
    After-agent hook: validates agent narrative output.
    Checks: PII leakage in output, empty response.
    """

    def after_agent(self, state: AgentState) -> AgentState:
        return self._check(state)

    async def aafter_agent(self, state: AgentState) -> AgentState:
        return self._check(state)

    def _check(self, state: AgentState) -> AgentState:
        narrative = state.get("narrative") or ""
        violations: list[str] = []

        # Redact PII leakage in output
        if _EMAIL_RE.search(narrative):
            narrative = _EMAIL_RE.sub("[EMAIL]", narrative)
            violations.append("output_pii:email_leaked")
        if _PHONE_RE.search(narrative):
            narrative = _PHONE_RE.sub("[PHONE]", narrative)
            violations.append("output_pii:phone_leaked")

        # Tech name leakage detection + redaction
        if _TECH_NAME_RE.search(narrative):
            narrative = _redact_tech_names(narrative)
            violations.append("output:tech_name_leaked")

        # Empty narrative sanity check
        if not narrative.strip():
            narrative = "I was unable to generate a response. Please rephrase your question."
            violations.append("output:empty_narrative")

        return {
            **state,
            "narrative": narrative,
            "output_guardrail_violations": violations,
        }


class MediaFlowToolGuardrail:
    """
    Wrap-tool-call hook: validates MCP tool inputs before execution.
    Blocks fire_alert unless hitl_decision == 'approve'.
    """

    def wrap_tool_call(self, tool_name: str, tool_input: dict, state: AgentState) -> dict:
        if tool_name == "fire_alert":
            if state.get("hitl_decision") != "approve":
                raise ValueError(
                    "fire_alert blocked: requires explicit human approval (hitl_decision='approve')"
                )
        return tool_input
