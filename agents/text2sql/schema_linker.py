"""
Schema Linker — maps NL entities to fact/dim columns.
Adapted from SQL-of-Thought arXiv:2509.00581.

Public API:
  link_schema(question) -> SchemaLink        — structured output (new)
  link_schema_dict(question) -> dict[str,str] — backward-compat shim
  get_schema_context() -> str
"""
from __future__ import annotations
from pydantic import BaseModel, Field
from api.llm import complete

_SCHEMA_CONTEXT = """
DuckDB table: media_dataset
Columns:
  video_id (VARCHAR), headline (VARCHAR), source (VARCHAR),
  published_flag (BOOLEAN), billable_flag (BOOLEAN),
  upload_date (VARCHAR — use TRY_CAST(upload_date AS TIMESTAMP)),
  processed_date (VARCHAR — use TRY_CAST(processed_date AS TIMESTAMP)),
  video_duration_sec (DOUBLE), avg_view_duration_sec (DOUBLE),
  avg_view_percentage (DOUBLE), subscribers_gained (DOUBLE),
  ctr_percentage (DOUBLE), impressions (VARCHAR — cast to DOUBLE),
  likes (DOUBLE), comments (DOUBLE), shares (DOUBLE),
  total_watch_time_hours (DOUBLE), traffic_source (VARCHAR),
  published_url (VARCHAR), workspace (VARCHAR),
  uploaded_by (VARCHAR), team_name (VARCHAR), language (VARCHAR),
  input_type (VARCHAR), output_type (VARCHAR),
  ai_output_type (VARCHAR), published_platform (VARCHAR),
  company (VARCHAR)

DuckDB rules:
- Use TRY_CAST(upload_date AS TIMESTAMP) — never ::TIMESTAMP
- published_flag comparisons: = true / = false (not = 1)
- CAST(impressions AS DOUBLE) for numeric ops

Dimension values:
- workspace: WS-DIGITAL-NEWS, WS-ENTERTAINMENT, WS-TECH-ANALYSIS, WS-LIFESTYLE, WS-SPORTS-LIVE
- input_type: interview, speech, debate, news_bulletin, special_report, press_conference, discussion_show
- ai_output_type: key_moments, chapters, full_package, summary, my_key_moments
- language: English, Hindi
- company: Company_A, Company_B
- output_type: shorts, reels
- published_platform: Youtube, Instagram
"""

_PROMPT_TEMPLATE = """You are a schema linking agent for a DuckDB analytics database.

Schema:
{schema}

Question: {question}

Identify which columns from media_dataset are relevant to answer this question.
List ONLY the column names needed, one per line, in the format:
column_name: reason it is needed

Be concise. Only include columns that are directly required."""

# ---------------------------------------------------------------------------
# Pydantic model
# ---------------------------------------------------------------------------

class SchemaLink(BaseModel):
    columns: dict[str, str] = Field(default_factory=dict)  # column → reason
    filter_values: dict[str, str] = Field(default_factory=dict)  # column → extracted value
    requires_date_filter: bool = False
    time_window_hint: str = ""  # "last 30 days", "this month", etc.

# ---------------------------------------------------------------------------
# Main function
# ---------------------------------------------------------------------------

def link_schema(question: str) -> SchemaLink:
    """Returns SchemaLink Pydantic object for columns relevant to the question."""
    try:
        from pydantic import ValidationError
        try:
            from api.llm import get_llm
            llm = get_llm(temperature=0.0).with_structured_output(SchemaLink)
            prompt = (
                f"You are a schema linking agent for a DuckDB analytics database.\n\n"
                f"Schema:\n{_SCHEMA_CONTEXT}\n\n"
                f"Question: {question}\n\n"
                "Identify which columns from media_dataset are relevant. "
                "For filter_values, extract any specific dimension values mentioned "
                "(e.g. 'WS-SPORTS-LIVE' for workspace). "
                "Set requires_date_filter=true if the question involves time/dates. "
                "Set time_window_hint to any time period mentioned."
            )
            result = llm.invoke(prompt)
            return result
        except (ValidationError, Exception):
            pass
    except ImportError:
        pass

    # Fallback: parse text output into SchemaLink
    try:
        prompt = _PROMPT_TEMPLATE.format(schema=_SCHEMA_CONTEXT, question=question)
        text = complete(prompt, max_tokens=512)
        columns = {}
        for line in text.strip().splitlines():
            if ":" in line:
                col, _, reason = line.partition(":")
                col = col.strip()
                if col and not col.startswith("#"):
                    columns[col] = reason.strip()
        return SchemaLink(columns=columns)
    except Exception:
        return SchemaLink()


def link_schema_dict(question: str) -> dict[str, str]:
    """Backward-compat shim — returns columns dict."""
    return link_schema(question).columns


def get_schema_context() -> str:
    return _SCHEMA_CONTEXT
