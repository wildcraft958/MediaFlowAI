"""
Guardrails — LLM-based SQL validator with LangChain Runnable interface.

Rules live in the validation prompt — no hardcoded column lists, workspace values,
or regex logic checks. The LLM evaluates the SQL against schema and DuckDB rules.

Only DDL/DML blocking uses a regex (security hard-stop — cannot trust LLM for this).

Public API:
  check_all(sql) -> GuardrailResult          — LLM validation (main API)
  guardrail_runnable                          — LangChain RunnableLambda for chain composition
  classify_violation(violations) -> str       — primary category by severity order
  check(sql) -> (bool, list[str])            — backward-compat shim
  check_columns(sql) -> (bool, list[str])    — backward-compat shim

Pipeline usage:
  # As standalone call
  result = check_all(sql)

  # As LangChain middleware in a chain
  from agents.text2sql.guardrails import guardrail_runnable
  pipeline = generate_sql_runnable | guardrail_runnable
"""
from __future__ import annotations
import re
from typing import Optional
from pydantic import BaseModel, Field
from langchain_core.runnables import RunnableLambda

# ---------------------------------------------------------------------------
# Pydantic models — shared with correction_loop, qna_agent
# ---------------------------------------------------------------------------

class GuardrailViolation(BaseModel):
    category: str           # "duckdb" | "syntax" | "schema_link" | "aggregation" | "filter"
    code: str               # fine-grained taxonomy code (see ERROR_TAXONOMY)
    message: str
    sql_fragment: Optional[str] = None


class GuardrailResult(BaseModel):
    safe: bool
    violations: list[GuardrailViolation] = Field(default_factory=list)
    primary_category: Optional[str] = None  # most severe category

# ---------------------------------------------------------------------------
# Error taxonomy reference (LLM is told to use these exact strings)
# ---------------------------------------------------------------------------

ERROR_TAXONOMY = {
    "syntax":      ["sql_syntax_error", "ddl_dml_blocked", "not_select", "invalid_alias", "sql_too_long"],
    "schema_link": ["table_missing", "col_missing", "ambiguous_col", "incorrect_foreign_key"],
    "join":        ["join_missing", "join_wrong_type", "extra_table", "incorrect_col"],
    "filter":      ["where_missing", "condition_wrong_col", "condition_type_mismatch", "value_format_wrong"],
    "aggregation": ["agg_no_groupby", "groupby_missing_col", "having_without_groupby"],
    "duckdb":      ["wrong_cast_syntax", "wrong_boolean_compare"],
}

_MAX_SQL_LEN = 50_000

_SEVERITY_ORDER = ["syntax", "duckdb", "schema_link", "aggregation", "filter"]

# ---------------------------------------------------------------------------
# Hard-stop regex checks (not delegated to LLM for determinism)
# ---------------------------------------------------------------------------

_DDL_DML_PATTERN = re.compile(
    r"\b(UPDATE|DELETE|DROP|INSERT|CREATE|ALTER|TRUNCATE|REPLACE|GRANT|REVOKE)\b",
    re.IGNORECASE,
)

# PostgreSQL-style :: cast is invalid DuckDB syntax — catch before LLM to ensure
# consistent blocking (LLM occasionally misses single-expression examples)
_PG_CAST_PATTERN = re.compile(r"::[A-Za-z]")

# ---------------------------------------------------------------------------
# Validation prompt — all rules live here, not in code
# ---------------------------------------------------------------------------

_VALIDATION_PROMPT = """You are a DuckDB SQL validator for the MediaFlow AI analytics platform.

Evaluate the SQL below against the schema, dimension values, and DuckDB rules.
Check every rule. Be precise — only flag genuine violations, not style issues.

=== SQL TO VALIDATE ===
{sql}

=== SCHEMA ===
Primary table: media_dataset
Columns:
  video_id (VARCHAR), headline (VARCHAR), source (VARCHAR),
  published_flag (BOOLEAN), billable_flag (BOOLEAN),
  upload_date (VARCHAR), processed_date (VARCHAR),
  video_duration_sec (DOUBLE), avg_view_duration_sec (DOUBLE),
  avg_view_percentage (DOUBLE), subscribers_gained (DOUBLE),
  ctr_percentage (DOUBLE), impressions (VARCHAR),
  likes (DOUBLE), comments (DOUBLE), shares (DOUBLE),
  total_watch_time_hours (DOUBLE), traffic_source (VARCHAR),
  published_url (VARCHAR), workspace (VARCHAR),
  uploaded_by (VARCHAR), team_name (VARCHAR), language (VARCHAR),
  input_type (VARCHAR), output_type (VARCHAR),
  ai_output_type (VARCHAR), published_platform (VARCHAR), company (VARCHAR)

Valid views/tables (besides media_dataset):
  fact_video_events, kpi_zsp, kpi_cpdg, kpi_lpi,
  v_pcr, v_fsc, v_gr, v_opi, v_teu, v_ail, v_sac, v_ahy, v_edr,
  v_hthr, v_tsqi, v_pig, v_agv, v_pmi, v_mci, v_dcdr,
  agg_daily_summary, agg_channel_funnel, agg_output_type_summary, agg_user_activity

=== VALID DIMENSION VALUES ===
workspace: WS-DIGITAL-NEWS, WS-ENTERTAINMENT, WS-TECH-ANALYSIS, WS-LIFESTYLE, WS-SPORTS-LIVE
language: English, Hindi
input_type: interview, speech, debate, news_bulletin, special_report, press_conference, discussion_show
ai_output_type: key_moments, chapters, full_package, summary, my_key_moments
output_type: shorts, reels
published_platform: Youtube, Instagram
company: Company_A, Company_B

=== RULES — check each one ===

[duckdb / wrong_cast_syntax]
Never use PostgreSQL-style cast (::). DuckDB requires function syntax.
  BAD:  upload_date::TIMESTAMP   processed_date::DOUBLE   impressions::FLOAT
  GOOD: TRY_CAST(upload_date AS TIMESTAMP)   CAST(impressions AS DOUBLE)

[duckdb / wrong_boolean_compare]
Boolean columns (published_flag, billable_flag) must compare with true/false, never integers.
  BAD:  published_flag = 1   billable_flag = 0   published_flag != 1
  GOOD: published_flag = true   billable_flag = false

[aggregation / agg_no_groupby]
When SELECT mixes aggregate functions (COUNT, SUM, AVG, MAX, MIN) with bare non-aggregated
column references, GROUP BY is required.
  EXCEPTION: SELECT COUNT(*) FROM ... with no other columns is always valid.
  BAD:  SELECT workspace, COUNT(*) FROM media_dataset
  GOOD: SELECT workspace, COUNT(*) FROM media_dataset GROUP BY workspace
  GOOD: SELECT COUNT(*) FROM media_dataset   ← no GROUP BY needed

[aggregation / having_without_groupby]
HAVING clause requires GROUP BY.
  BAD:  SELECT COUNT(*) FROM media_dataset HAVING COUNT(*) > 10

[filter / value_format_wrong]
String literal values used in WHERE conditions for dimension columns must match the valid
dimension values exactly (case-sensitive, exact spelling).
  BAD:  WHERE workspace = 'sports-live'   (should be 'WS-SPORTS-LIVE')
  BAD:  WHERE language = 'hindi'          (should be 'Hindi')
  GOOD: WHERE workspace = 'WS-SPORTS-LIVE'

[schema_link / col_missing]
All column names referenced in SELECT, WHERE, GROUP BY, ORDER BY, HAVING must exist in
media_dataset or the view/table being queried. Do not flag SQL functions, aliases,
or subquery results as missing columns.

=== RESPONSE INSTRUCTIONS ===
- Return safe=true and an empty violations list if the SQL has NO violations.
- For each violation found, use EXACTLY the category and code shown in [brackets] above.
- sql_fragment: the shortest excerpt (≤ 40 chars) showing the problem; null if not applicable.
- DO NOT flag: CTEs (WITH ... AS), window functions (OVER / PARTITION BY), subqueries,
  DuckDB built-in functions (DATE_TRUNC, STRFTIME, NOW, EPOCH, INTERVAL, COALESCE, NULLIF,
  ROW_NUMBER, RANK, LAG, LEAD, etc.), or valid aliases."""

# ---------------------------------------------------------------------------
# LLM-based validation
# ---------------------------------------------------------------------------

def _llm_validate(sql: str) -> GuardrailResult:
    """
    Calls the LLM with structured output to validate the SQL.
    Falls back to GuardrailResult(safe=True) if LLM is unavailable
    (fail-open: don't block the pipeline on a validator error).
    """
    try:
        from api.llm import get_llm
        from pydantic import ValidationError

        llm = get_llm(temperature=0.0).with_structured_output(GuardrailResult)
        prompt = _VALIDATION_PROMPT.format(sql=sql)
        result = llm.invoke(prompt)

        # Compute primary_category if not set by LLM
        if result.violations and not result.primary_category:
            result.primary_category = classify_violation(result.violations)

        return result

    except Exception:
        # Validator failure → fail-open, let the SQL attempt execution
        return GuardrailResult(safe=True)

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def check_all(sql: str) -> GuardrailResult:
    """
    Validate SQL. Returns GuardrailResult.

    1. DDL/DML regex hard-stop (security boundary — instantaneous, no LLM).
    2. Length cap — overly long SQL likely LLM hallucination.
    3. LLM validates everything else: casts, booleans, aggregation, filter values,
       schema linking — rules live in the prompt, not in code.
    """
    # Security hard-stop: DDL/DML never reaches the LLM
    m = _DDL_DML_PATTERN.search(sql)
    if m:
        violation = GuardrailViolation(
            category="syntax",
            code="ddl_dml_blocked",
            message=f"Blocked write operation: {m.group(0)}",
            sql_fragment=m.group(0),
        )
        return GuardrailResult(safe=False, violations=[violation], primary_category="syntax")

    # DuckDB cast syntax: :: is PostgreSQL syntax, always block deterministically
    m_cast = _PG_CAST_PATTERN.search(sql)
    if m_cast:
        violation = GuardrailViolation(
            category="duckdb",
            code="wrong_cast_syntax",
            message="Use TRY_CAST(col AS TYPE) instead of PostgreSQL-style col::TYPE",
            sql_fragment=m_cast.group(0),
        )
        return GuardrailResult(safe=False, violations=[violation], primary_category="duckdb")

    # Length cap — legitimate analytics queries rarely exceed 2,000 chars
    if len(sql) > _MAX_SQL_LEN:
        violation = GuardrailViolation(
            category="syntax",
            code="sql_too_long",
            message=f"SQL exceeds {_MAX_SQL_LEN} character limit ({len(sql)} chars)",
        )
        return GuardrailResult(safe=False, violations=[violation], primary_category="syntax")

    # All other validation: LLM-based
    return _llm_validate(sql)


def classify_violation(violations: list[GuardrailViolation]) -> str:
    """Returns primary category by severity: syntax > duckdb > schema_link > aggregation > filter."""
    found = {v.category for v in violations}
    for cat in _SEVERITY_ORDER:
        if cat in found:
            return cat
    return violations[0].category if violations else "unknown"


# LangChain Runnable — composes directly into generation chains:
#   sql_chain = generate_runnable | guardrail_runnable
guardrail_runnable: RunnableLambda = RunnableLambda(check_all)

# ---------------------------------------------------------------------------
# Backward-compat shims (used by existing tests + text2sql_node callers)
# ---------------------------------------------------------------------------

def check(sql: str) -> tuple[bool, list[str]]:
    """Shim: calls check_all(), returns (safe, errors) for syntax/duckdb violations only."""
    result = check_all(sql)
    errors = [
        v.message for v in result.violations
        if v.category in ("syntax", "duckdb")
    ]
    if errors:
        return False, errors
    return True, []


def check_columns(sql: str) -> tuple[bool, list[str]]:
    """Shim: calls check_all(), returns schema_link violations."""
    result = check_all(sql)
    errors = [v.message for v in result.violations if v.category == "schema_link"]
    if errors:
        return False, errors
    return True, []
