"""
SQL Generator — produces DuckDB SQL from the CoT plan.
Adapted from SQL-of-Thought arXiv:2509.00581 (sql_agent).
"""
from __future__ import annotations
import re
from api.llm import complete
from agents.text2sql.schema_linker import get_schema_context

_PROMPT_TEMPLATE = """You are a DuckDB SQL generation agent.

Schema:
{schema}

Question: {question}

Query plan:
{plan}

Write a single DuckDB SQL SELECT query that implements this plan exactly.

Critical DuckDB syntax rules:
- TRY_CAST(upload_date AS TIMESTAMP) — never use ::TIMESTAMP
- TRY_CAST(processed_date AS TIMESTAMP) — never use ::TIMESTAMP
- CAST(impressions AS DOUBLE) for impressions column
- published_flag = true  (not = 1, not = 'true')
- For date intervals: NOW() - INTERVAL '30 days'
- No UPDATE, DELETE, DROP, INSERT, CREATE statements

Return ONLY the SQL query, no explanation, no markdown fences."""


def generate_sql(question: str, plan: str) -> str:
    """Returns a DuckDB SQL SELECT query string."""
    prompt = _PROMPT_TEMPLATE.format(
        schema=get_schema_context(),
        question=question,
        plan=plan,
    )
    return _postprocess_sql(complete(prompt, max_tokens=1024))


def _postprocess_sql(raw: str) -> str:
    """Strip markdown fences and normalize whitespace."""
    raw = re.sub(r"```(?:sql)?\s*", "", raw)
    raw = re.sub(r"```", "", raw)
    return raw.strip()
