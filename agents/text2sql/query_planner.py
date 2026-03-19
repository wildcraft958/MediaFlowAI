"""
Query Planner — CoT step-by-step SQL plan before generation.
Adapted from SQL-of-Thought arXiv:2509.00581 (query_plan_agent).
"""
from __future__ import annotations
from api.llm import complete
from agents.text2sql.schema_linker import get_schema_context

_PROMPT_TEMPLATE = """You are a SQL query planning agent for DuckDB.

Schema:
{schema}

Relevant columns identified: {linked_columns}

Question: {question}

Write a numbered step-by-step natural language plan for the SQL query.
Each step should describe one SQL clause or operation.
Example:
1. FROM frammer_dataset
2. WHERE frammer_workspace = 'WS-SPORTS-LIVE'
3. GROUP BY frammer_workspace
4. SELECT frammer_workspace, COUNT(*) as total, ...
5. ORDER BY total DESC

Important DuckDB rules:
- Use TRY_CAST(upload_date AS TIMESTAMP) for date comparisons
- Use CAST(impressions AS DOUBLE) for numeric operations on impressions
- Use published_flag = true (not = 1)

Plan (numbered steps):"""


def plan_query(question: str, linked_columns: dict[str, str]) -> str:
    """Returns a natural-language CoT plan for the SQL query."""
    cols_str = "\n".join(f"- {col}: {reason}" for col, reason in linked_columns.items()) or "all columns"
    prompt = _PROMPT_TEMPLATE.format(
        schema=get_schema_context(),
        linked_columns=cols_str,
        question=question,
    )
    return complete(prompt, max_tokens=512)
