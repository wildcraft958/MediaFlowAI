"""
Query Planner — CoT step-by-step SQL plan before generation.
Adapted from SQL-of-Thought arXiv:2509.00581 (query_plan_agent).

Public API:
  plan_query(question, linked_columns) -> QueryPlan   — structured output (new)
  get_schema_context() re-exported for convenience
"""
from __future__ import annotations
from typing import Union
from pydantic import BaseModel, Field
from api.llm import complete
from agents.text2sql.schema_linker import get_schema_context, SchemaLink

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

# ---------------------------------------------------------------------------
# Pydantic model
# ---------------------------------------------------------------------------

class QueryPlan(BaseModel):
    steps: list[str] = Field(default_factory=list)  # ordered CoT steps
    tables_used: list[str] = Field(default_factory=lambda: ["frammer_dataset"])
    aggregation_strategy: str = "none"  # "none"|"simple_count"|"grouped_agg"|"window_function"
    requires_join: bool = False
    duckdb_notes: list[str] = Field(default_factory=list)

# ---------------------------------------------------------------------------
# Main function
# ---------------------------------------------------------------------------

def plan_query(question: str, linked_columns: Union[dict[str, str], SchemaLink]) -> QueryPlan:
    """Returns QueryPlan Pydantic object for the SQL query."""
    # Normalize linked_columns to dict
    if isinstance(linked_columns, SchemaLink):
        cols_dict = linked_columns.columns
    else:
        cols_dict = linked_columns

    cols_str = "\n".join(f"- {col}: {reason}" for col, reason in cols_dict.items()) or "all columns"

    try:
        from pydantic import ValidationError
        try:
            from api.llm import get_llm
            llm = get_llm(temperature=0.7).with_structured_output(QueryPlan)
            prompt = (
                f"You are a SQL query planning agent for DuckDB.\n\n"
                f"Schema:\n{get_schema_context()}\n\n"
                f"Relevant columns: {cols_str}\n\n"
                f"Question: {question}\n\n"
                "Produce a QueryPlan with:\n"
                "- steps: numbered CoT steps for the SQL query\n"
                "- tables_used: DuckDB tables/views referenced\n"
                "- aggregation_strategy: 'none', 'simple_count', 'grouped_agg', or 'window_function'\n"
                "- requires_join: true if multiple tables are joined\n"
                "- duckdb_notes: any DuckDB-specific syntax reminders\n\n"
                "DuckDB rules: TRY_CAST for dates, published_flag = true (not = 1)."
            )
            result = llm.invoke(prompt)
            return result
        except (ValidationError, Exception):
            pass
    except ImportError:
        pass

    # Fallback: parse text plan into QueryPlan
    try:
        prompt = _PROMPT_TEMPLATE.format(
            schema=get_schema_context(),
            linked_columns=cols_str,
            question=question,
        )
        raw = complete(prompt, max_tokens=512)
        steps = [line.strip() for line in raw.splitlines() if line.strip()]
        return QueryPlan(
            steps=steps,
            tables_used=["frammer_dataset"],
            aggregation_strategy="unknown",
        )
    except Exception:
        return QueryPlan(steps=[f"SELECT * FROM frammer_dataset LIMIT 10"])
