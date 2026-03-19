"""
SQL Generator — produces DuckDB SQL from the CoT plan.
Adapted from SQL-of-Thought arXiv:2509.00581 (sql_agent).

Public API:
  generate_sql(question, plan) -> GeneratedSQL   — structured output (new)
  _postprocess_sql(raw) -> str                   — strip markdown fences
"""
from __future__ import annotations
import re
from typing import Union
from pydantic import BaseModel, Field
from api.llm import complete
from agents.text2sql.schema_linker import get_schema_context

_PROMPT_TEMPLATE = """You are a DuckDB SQL generation agent.

CRITICAL: Generate ONLY SELECT statements. NEVER generate DELETE, DROP, ALTER, TRUNCATE, UPDATE, INSERT, CREATE, GRANT, REVOKE.

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
- ONLY SELECT statements — no DDL/DML (DELETE, DROP, ALTER, TRUNCATE, UPDATE, INSERT, CREATE, GRANT, REVOKE)

Return ONLY the SQL query, no explanation, no markdown fences."""

# ---------------------------------------------------------------------------
# Pydantic model
# ---------------------------------------------------------------------------

class GeneratedSQL(BaseModel):
    sql: str = ""                   # complete DuckDB SELECT, no markdown fences
    confidence: float = 0.5        # 0.0–1.0 self-assessed
    warnings: list[str] = Field(default_factory=list)  # known limitations

# ---------------------------------------------------------------------------
# Main function
# ---------------------------------------------------------------------------

def generate_sql(
    question: str,
    plan: Union["QueryPlan", str],  # noqa: F821
) -> GeneratedSQL:
    """Returns GeneratedSQL Pydantic object."""
    # Normalize plan to string
    if hasattr(plan, "steps"):
        plan_str = "\n".join(f"{i+1}. {s}" for i, s in enumerate(plan.steps))
    else:
        plan_str = str(plan)

    try:
        from pydantic import ValidationError
        try:
            from api.llm import get_llm
            llm = get_llm(temperature=0.0).with_structured_output(GeneratedSQL)
            prompt = (
                f"You are a DuckDB SQL generation agent.\n\n"
                "CRITICAL: Generate ONLY SELECT statements. NEVER generate DELETE, DROP, ALTER, "
                "TRUNCATE, UPDATE, INSERT, CREATE, GRANT, REVOKE.\n\n"
                f"Schema:\n{get_schema_context()}\n\n"
                f"Question: {question}\n\n"
                f"Query plan:\n{plan_str}\n\n"
                "Produce a GeneratedSQL with:\n"
                "- sql: complete DuckDB SELECT query (no markdown, no fences)\n"
                "- confidence: float 0.0-1.0 for your confidence\n"
                "- warnings: any known limitations or assumptions\n\n"
                "Critical DuckDB rules:\n"
                "- TRY_CAST(col AS TIMESTAMP) — never ::TIMESTAMP\n"
                "- published_flag = true (not = 1)\n"
                "- CAST(impressions AS DOUBLE) for impressions\n"
                "- ONLY SELECT — no DDL/DML (DELETE, DROP, ALTER, TRUNCATE, UPDATE, INSERT, CREATE, GRANT, REVOKE)."
            )
            result = llm.invoke(prompt)
            result.sql = _postprocess_sql(result.sql)
            return result
        except (ValidationError, Exception):
            pass
    except ImportError:
        pass

    # Fallback: text completion
    try:
        prompt = _PROMPT_TEMPLATE.format(
            schema=get_schema_context(),
            question=question,
            plan=plan_str,
        )
        raw = complete(prompt, max_tokens=1024)
        return GeneratedSQL(sql=_postprocess_sql(raw), confidence=0.5)
    except Exception:
        return GeneratedSQL(
            sql="SELECT * FROM media_dataset LIMIT 10",
            confidence=0.1,
            warnings=["Fallback SQL used — generation failed"],
        )


def _postprocess_sql(raw: str) -> str:
    """Strip markdown fences and normalize whitespace."""
    raw = re.sub(r"```(?:sql)?\s*", "", raw)
    raw = re.sub(r"```", "", raw)
    return raw.strip()
