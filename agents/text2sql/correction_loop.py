"""
Correction Loop — taxonomy-driven retry on SQL execution errors.
Adapted from SQL-of-Thought arXiv:2509.00581.
Max 2 retries.

Public API:
  classify_execution_error(error) -> (category, code)
  run_correction_loop(question, sql, execute_fn, initial_violations=None)
     -> (final_sql, rows_or_None, error_or_None, correction_log)
"""
from __future__ import annotations
from pydantic import BaseModel, Field
from api.llm import complete
from agents.text2sql.schema_linker import get_schema_context
from agents.text2sql.sql_generator import _postprocess_sql

MAX_RETRIES = 2

# ---------------------------------------------------------------------------
# Error classification
# ---------------------------------------------------------------------------

_EXECUTION_ERROR_MAP = [
    ("Binder Error: Referenced column",  "schema_link",  "col_missing"),
    ("Binder Error: Table",              "schema_link",  "table_missing"),
    ("Catalog Error",                    "schema_link",  "table_missing"),
    ("Parser Error",                     "syntax",       "sql_syntax_error"),
    ("Invalid Input Error: Conversion",  "duckdb",       "wrong_cast_syntax"),
    ("Constraint Error",                 "filter",       "condition_type_mismatch"),
]


def classify_execution_error(error: str) -> tuple[str, str]:
    """Rule-based mapping from DuckDB error string to (category, code)."""
    for substring, category, code in _EXECUTION_ERROR_MAP:
        if substring in error:
            return category, code
    return "syntax", "unknown"

# ---------------------------------------------------------------------------
# Pydantic model
# ---------------------------------------------------------------------------

class CorrectionPlan(BaseModel):
    error_category: str = "syntax"
    error_code: str = "unknown"
    root_cause: str = ""       # one-sentence diagnosis
    fix_steps: list[str] = Field(default_factory=list)  # ≤5 numbered steps
    key_rule: str = ""         # the single most important DuckDB rule to apply

# ---------------------------------------------------------------------------
# Per-category prompt templates (focused, fewer tokens)
# ---------------------------------------------------------------------------

_CATEGORY_PROMPTS: dict[str, str] = {
    "duckdb": """DuckDB SQL correction — cast and boolean rules.

Schema: {schema}
Question: {question}
Wrong SQL:
{wrong_sql}

Error: {error}
Prior attempts: {scratchpad}

Rules to fix:
- TRY_CAST(col AS TIMESTAMP) — never ::TIMESTAMP or ::DOUBLE
- published_flag = true (never = 1, = 0, = 'true')
- billable_flag = true (never = 1)
- CAST(impressions AS DOUBLE) for numeric ops on impressions

Produce a CorrectionPlan with root_cause, fix_steps (≤5), and key_rule.""",

    "schema_link": """DuckDB SQL correction — schema linking error.

Schema: {schema}
Question: {question}
Wrong SQL:
{wrong_sql}

Error: {error}
Prior attempts: {scratchpad}

Available tables: media_dataset, fact_video_events, kpi_zsp, kpi_cpdg, kpi_lpi, v_pcr, v_fsc
Available columns in media_dataset: video_id, headline, source, published_flag, billable_flag,
upload_date, processed_date, video_duration_sec, avg_view_duration_sec, avg_view_percentage,
subscribers_gained, ctr_percentage, impressions, likes, comments, shares, total_watch_time_hours,
traffic_source, published_url, workspace, uploaded_by, team_name, language,
input_type, output_type, ai_output_type, published_platform, company

Produce a CorrectionPlan identifying the missing/wrong column or table and how to fix it.""",

    "aggregation": """DuckDB SQL correction — aggregation error.

Schema: {schema}
Question: {question}
Wrong SQL:
{wrong_sql}

Error: {error}
Prior attempts: {scratchpad}

Aggregation rules:
- Every non-aggregated column in SELECT must appear in GROUP BY
- HAVING requires GROUP BY
- COUNT(*) alone needs no GROUP BY
- Window functions (ROW_NUMBER OVER, ...) are an alternative to GROUP BY

Produce a CorrectionPlan with fix_steps to add correct GROUP BY.""",

    "filter": """DuckDB SQL correction — filter value error.

Schema: {schema}
Question: {question}
Wrong SQL:
{wrong_sql}

Error: {error}
Prior attempts: {scratchpad}

Valid dimension values:
- workspace: WS-DIGITAL-NEWS, WS-ENTERTAINMENT, WS-TECH-ANALYSIS, WS-LIFESTYLE, WS-SPORTS-LIVE
- language: English, Hindi
- input_type: interview, speech, debate, news_bulletin, special_report, press_conference, discussion_show
- published_platform: Youtube, Instagram

Produce a CorrectionPlan correcting the filter value to match known dimension values.""",

    "syntax": """DuckDB SQL correction — syntax error.

Schema: {schema}
Question: {question}
Wrong SQL:
{wrong_sql}

Error: {error}
Prior attempts: {scratchpad}

Fix the SQL syntax error. Ensure:
- Query starts with SELECT or WITH
- All parentheses are balanced
- Aliases are properly quoted if needed
- No trailing commas before FROM/WHERE/GROUP BY

Produce a CorrectionPlan with the root cause and fix steps.""",

    "structural": """DuckDB SQL correction — structural error.

Schema: {schema}
Question: {question}
Wrong SQL:
{wrong_sql}

Error: {error}
Prior attempts: {scratchpad}

Check for missing clauses, incorrect joins, or malformed subqueries.
Produce a CorrectionPlan with fix steps.""",
}

_CORRECTION_SQL_PROMPT = """You are a DuckDB SQL correction agent.

Schema:
{schema}

Original question: {question}
Wrong SQL:
{wrong_sql}

Correction plan:
{plan}

Write the corrected DuckDB SQL SELECT query.
Apply ONLY the fixes described in the plan. Do not change other parts.

Critical DuckDB rules:
- TRY_CAST(col AS TIMESTAMP) — never ::TIMESTAMP
- CAST(impressions AS DOUBLE) for impressions
- published_flag = true (not = 1)

Return ONLY the corrected SQL, no explanation."""


def _get_correction_plan(
    question: str,
    wrong_sql: str,
    error: str,
    category: str,
    code: str,
    scratchpad: str,
) -> CorrectionPlan:
    """Call LLM to produce a structured CorrectionPlan for the given error category."""
    template = _CATEGORY_PROMPTS.get(category, _CATEGORY_PROMPTS["syntax"])
    prompt = template.format(
        schema=get_schema_context(),
        question=question,
        wrong_sql=wrong_sql,
        error=error,
        scratchpad=scratchpad or "None",
    )
    try:
        from pydantic import ValidationError
        from api.llm import get_llm
        llm = get_llm(temperature=0.0).with_structured_output(CorrectionPlan)
        result = llm.invoke(prompt)
        result.error_category = category
        result.error_code = code
        return result
    except Exception:
        # Fallback: text completion → wrap in CorrectionPlan
        try:
            raw = complete(prompt, max_tokens=512)
            return CorrectionPlan(
                error_category=category,
                error_code=code,
                root_cause=raw[:200],
                fix_steps=[raw],
                key_rule="See root_cause",
            )
        except Exception:
            return CorrectionPlan(
                error_category=category,
                error_code=code,
                root_cause=f"Error: {error[:100]}",
                fix_steps=["Rewrite the SQL query correctly."],
                key_rule="Follow DuckDB syntax",
            )


def _generate_corrected_sql(
    question: str,
    wrong_sql: str,
    correction: CorrectionPlan,
) -> str:
    """Generate corrected SQL from a CorrectionPlan."""
    plan_text = "\n".join(
        [f"Root cause: {correction.root_cause}"]
        + [f"{i+1}. {s}" for i, s in enumerate(correction.fix_steps)]
        + ([f"Key rule: {correction.key_rule}"] if correction.key_rule else [])
    )
    prompt = _CORRECTION_SQL_PROMPT.format(
        schema=get_schema_context(),
        question=question,
        wrong_sql=wrong_sql,
        plan=plan_text,
    )
    return _postprocess_sql(complete(prompt, max_tokens=1024))

# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def run_correction_loop(
    question: str,
    sql: str,
    execute_fn,
    initial_violations: list | None = None,
) -> tuple[str, list[dict] | None, str | None, list[str]]:
    """
    Tries to execute `sql`, retrying up to MAX_RETRIES times on failure.
    Returns (final_sql, result_rows_or_None, final_error_or_None, correction_log).

    correction_log entries: "attempt_N: category/code → description"

    If initial_violations provided (from guardrail check_all()):
      - Uses violations[0].category/code directly — no LLM classification
    Otherwise:
      - Classifies execution error via classify_execution_error()
    """
    scratchpad_entries: list[str] = []
    correction_log: list[str] = []
    current_sql = sql
    last_error: str | None = None

    for attempt in range(MAX_RETRIES + 1):
        result, error = execute_fn(current_sql)
        if error is None:
            return current_sql, result, None, correction_log

        last_error = error
        if attempt >= MAX_RETRIES:
            break

        # Classify the error
        if attempt == 0 and initial_violations:
            v = initial_violations[0]
            category, code = v.category, v.code
        else:
            category, code = classify_execution_error(error)

        correction_log.append(
            f"attempt_{attempt + 1}: {category}/{code} — error: {error[:80]}"
        )

        scratchpad = "\n".join(
            f"Attempt {i+1}: {e}" for i, e in enumerate(scratchpad_entries)
        )

        correction = _get_correction_plan(
            question, current_sql, error, category, code, scratchpad
        )
        current_sql = _generate_corrected_sql(question, current_sql, correction)
        scratchpad_entries.append(error)

        correction_log.append(
            f"attempt_{attempt + 1}_applied: {correction.key_rule or 'fix applied'}"
        )

    return current_sql, None, last_error, correction_log
