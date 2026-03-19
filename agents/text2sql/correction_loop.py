"""
Correction Loop — taxonomy-guided retry on SQL execution errors.
Adapted from SQL-of-Thought arXiv:2509.00581.
Max 2 retries.
"""
from __future__ import annotations
from api.llm import complete
from agents.text2sql.schema_linker import get_schema_context
from agents.text2sql.sql_generator import _postprocess_sql

MAX_RETRIES = 2

_CORRECTION_PLAN_PROMPT = """You are a SQL error correction planning agent for DuckDB.

Schema:
{schema}

Original question: {question}
Wrong SQL:
{wrong_sql}

Error encountered:
{error}

Previous attempts (if any):
{scratchpad}

Analyze the error and write a concise correction plan (numbered steps).
Focus on the specific error category and how to fix it.
Keep the plan under 5 steps."""

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


def correction_plan(question: str, wrong_sql: str, error: str, scratchpad: str = "") -> str:
    prompt = _CORRECTION_PLAN_PROMPT.format(
        schema=get_schema_context(),
        question=question,
        wrong_sql=wrong_sql,
        error=error,
        scratchpad=scratchpad or "None",
    )
    return complete(prompt, max_tokens=512)


def correction_sql(question: str, wrong_sql: str, plan: str) -> str:
    prompt = _CORRECTION_SQL_PROMPT.format(
        schema=get_schema_context(),
        question=question,
        wrong_sql=wrong_sql,
        plan=plan,
    )
    return _postprocess_sql(complete(prompt, max_tokens=1024))


def run_correction_loop(
    question: str,
    sql: str,
    execute_fn,
) -> tuple[str, list[dict] | None, str | None]:
    """
    Tries to execute `sql`, retrying up to MAX_RETRIES times on failure.
    Returns (final_sql, result_rows_or_None, final_error_or_None).
    """
    scratchpad_entries = []
    current_sql = sql
    last_error = None

    for attempt in range(MAX_RETRIES + 1):
        result, error = execute_fn(current_sql)
        if error is None:
            return current_sql, result, None

        last_error = error
        if attempt >= MAX_RETRIES:
            break

        scratchpad = "\n".join(
            f"Attempt {i+1}: {e}" for i, e in enumerate(scratchpad_entries)
        )
        plan = correction_plan(question, current_sql, error, scratchpad)
        current_sql = correction_sql(question, current_sql, plan)
        scratchpad_entries.append(error)

    return current_sql, None, last_error
