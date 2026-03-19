"""
Schema Linker — maps NL entities to fact/dim columns.
Adapted from SQL-of-Thought arXiv:2509.00581.
"""
from __future__ import annotations
from api.llm import complete

_SCHEMA_CONTEXT = """
DuckDB table: frammer_dataset
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
  published_url (VARCHAR), frammer_workspace (VARCHAR),
  uploaded_by (VARCHAR), team_name (VARCHAR), language (VARCHAR),
  input_type (VARCHAR), output_type (VARCHAR),
  frammer_output_type (VARCHAR), published_platform (VARCHAR),
  company (VARCHAR)

DuckDB rules:
- Use TRY_CAST(upload_date AS TIMESTAMP) — never ::TIMESTAMP
- published_flag comparisons: = true / = false (not = 1)
- CAST(impressions AS DOUBLE) for numeric ops

Dimension values:
- frammer_workspace: WS-DIGITAL-NEWS, WS-ENTERTAINMENT, WS-TECH-ANALYSIS, WS-LIFESTYLE, WS-SPORTS-LIVE
- input_type: interview, speech, debate, news_bulletin, special_report, press_conference, discussion_show
- frammer_output_type: key_moments, chapters, full_package, summary, my_key_moments
- language: English, Hindi
- company: Company_A, Company_B
- output_type: shorts, reels
- published_platform: Youtube, Instagram
"""

_PROMPT_TEMPLATE = """You are a schema linking agent for a DuckDB analytics database.

Schema:
{schema}

Question: {question}

Identify which columns from frammer_dataset are relevant to answer this question.
List ONLY the column names needed, one per line, in the format:
column_name: reason it is needed

Be concise. Only include columns that are directly required."""


def link_schema(question: str) -> dict[str, str]:
    """Returns {{column_name: reason}} for columns relevant to the question."""
    try:
        prompt = _PROMPT_TEMPLATE.format(schema=_SCHEMA_CONTEXT, question=question)
        text = complete(prompt, max_tokens=512)
        result = {}
        for line in text.strip().splitlines():
            if ":" in line:
                col, _, reason = line.partition(":")
                col = col.strip()
                if col and not col.startswith("#"):
                    result[col] = reason.strip()
        return result
    except Exception:
        return {}


def get_schema_context() -> str:
    return _SCHEMA_CONTEXT
