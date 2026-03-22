"""
MediaFlow AI agent middleware - input, output, and tool-call guardrails.

Input guardrail: fast regex checks only (PII, injection, sensitive content).
Domain relevance classification is handled by the router's unified LLM call.
Output guardrail: regex-based PII/tech-name redaction (post-processing).
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

# ── Sensitive content patterns (hard block, no LLM needed) ───────────────────
_SENSITIVE_RE = re.compile(
    r"\b(password|credit\s*card|ssn|social\s*security|bank\s*account|"
    r"delete\s+database|drop\s+table)\b",
    re.IGNORECASE,
)

# ── Tech name leakage patterns (output guardrail) ───────────────────────────
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


# ── Off-topic narrative (used by router's unified classifier) ────────────────
# Domain relevance is now classified by the router's single unified LLM call
# (agents/qna_agent.py _classify_query). Middleware only handles fast regex
# checks: PII, injection, sensitive content. No LLM call here.

_OFF_TOPIC_NARRATIVE = (
    "I can only answer questions about the MediaFlow AI analytics dashboard: "
    "KPIs, workspace performance, publish funnels, video trends, and team activity.\n\n"
    "Try asking:\n"
    '- "Which workspace has the lowest PCR?"\n'
    '- "Show upload vs publish trend for WS-SPORTS-LIVE"\n'
    '- "What is the LPI score for Hindi content?"'
)


class MediaFlowInputGuardrail:
    """
    Before-agent hook: validates and sanitizes inbound user query.

    Checks (in order, all regex — fast, no LLM call):
    1. PII detection/redaction (regex - appropriate for pattern matching)
    2. Prompt injection detection (regex - flag only)
    3. Sensitive content hard-block (regex - passwords, SSN, etc.)

    Domain relevance is handled by the router's unified LLM classifier.
    Returns updated state dict. On hard block, sets 'error' and 'narrative'
    so the conditional edge routes to narrate.
    """

    def before_agent(self, state: AgentState) -> AgentState:
        return self._check(state)

    async def abefore_agent(self, state: AgentState) -> AgentState:
        return self._check(state)

    def _check(self, state: AgentState) -> AgentState:
        query = state.get("query", "")
        violations: list[str] = []
        sanitized = query

        # 1. PII redaction (regex)
        if _EMAIL_RE.search(query):
            sanitized = _EMAIL_RE.sub("[EMAIL]", sanitized)
            violations.append("pii:email_redacted")
        if _PHONE_RE.search(sanitized):
            sanitized = _PHONE_RE.sub("[PHONE]", sanitized)
            violations.append("pii:phone_redacted")

        # 2. Injection detection (regex, flag only)
        if _INJECTION_RE.search(query):
            violations.append("injection:prompt_injection_detected")

        # 3. Sensitive content hard block (regex)
        if _SENSITIVE_RE.search(query):
            return {
                **state,
                "error": "Query blocked: sensitive content detected.",
                "narrative": "I can only answer questions about MediaFlow AI analytics data.",
                "input_guardrail_violations": violations + ["scope:blocked"],
                "pii_redacted": bool(violations),
            }

        # Domain relevance is handled by the router's unified LLM classifier.
        # No LLM call here — middleware only does fast regex checks.

        return {
            **state,
            "query": sanitized,
            "input_guardrail_violations": violations,
            "pii_redacted": bool(violations),
        }


class MediaFlowOutputGuardrail:
    """
    After-agent hook: validates agent narrative output.
    Checks: PII leakage in output, tech name leakage, empty response.
    Regex is appropriate here (post-processing redaction).
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

        # Tech name leakage redaction
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
