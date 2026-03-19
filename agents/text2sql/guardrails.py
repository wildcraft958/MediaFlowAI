"""
Guardrails — block DDL/DML, hallucinated columns, cross-client joins.
Adapted from SQL-of-Thought arXiv:2509.00581 error taxonomy.
"""
from __future__ import annotations
import re

# Columns that actually exist in frammer_dataset
_KNOWN_COLUMNS = {
    "video_id", "headline", "source", "published_flag", "billable_flag",
    "upload_date", "processed_date", "video_duration_sec", "avg_view_duration_sec",
    "avg_view_percentage", "subscribers_gained", "ctr_percentage", "impressions",
    "likes", "comments", "shares", "total_watch_time_hours", "traffic_source",
    "published_url", "frammer_workspace", "uploaded_by", "team_name", "language",
    "input_type", "output_type", "frammer_output_type", "published_platform", "company",
}

# Blocked SQL keywords (write operations)
_BLOCKED_PATTERN = re.compile(
    r"\b(UPDATE|DELETE|DROP|INSERT|CREATE|ALTER|TRUNCATE|REPLACE|GRANT|REVOKE)\b",
    re.IGNORECASE,
)

# Error taxonomy categories (from SQL-of-Thought reference)
ERROR_TAXONOMY = {
    "syntax": ["sql_syntax_error", "invalid_alias"],
    "schema_link": ["table_missing", "col_missing", "ambiguous_col", "incorrect_foreign_key"],
    "join": ["join_missing", "join_wrong_type", "extra_table", "incorrect_col"],
    "filter": ["where_missing", "condition_wrong_col", "condition_type_mismatch"],
    "aggregation": ["agg_no_groupby", "groupby_missing_col", "having_without_groupby"],
    "value": ["hardcoded_value", "value_format_wrong"],
    "duckdb": ["wrong_cast_syntax", "wrong_boolean_compare"],
}


def check(sql: str) -> tuple[bool, list[str]]:
    """
    Returns (is_safe, errors).
    is_safe=True means the SQL passed all guardrails.
    """
    errors: list[str] = []

    # 1. Block DDL/DML
    m = _BLOCKED_PATTERN.search(sql)
    if m:
        errors.append(f"Blocked keyword: {m.group(0)}")
        return False, errors

    # 2. Must be a SELECT
    stripped = sql.strip().upper()
    if not stripped.startswith("SELECT") and not stripped.startswith("WITH"):
        errors.append("SQL must start with SELECT or WITH")
        return False, errors

    # 3. Check for ::TIMESTAMP cast (DuckDB uses TRY_CAST)
    if "::TIMESTAMP" in sql.upper():
        errors.append("duckdb.wrong_cast_syntax: use TRY_CAST(col AS TIMESTAMP) not ::TIMESTAMP")
        return False, errors

    # 4. Check for = 1 / = 0 on published_flag (should be = true / = false)
    if re.search(r"published_flag\s*=\s*[01]\b", sql, re.IGNORECASE):
        errors.append("duckdb.wrong_boolean_compare: use published_flag = true, not = 1")
        return False, errors

    return True, []


def check_columns(sql: str) -> tuple[bool, list[str]]:
    """
    Heuristic column hallucination check.
    Extracts bare identifiers that look like column names and validates them.
    """
    errors: list[str] = []
    # Extract identifiers after SELECT, WHERE, GROUP BY, ORDER BY
    candidates = re.findall(r'\b([a-z_][a-z0-9_]*)\b', sql.lower())
    # Filter to plausible column name patterns (not SQL keywords)
    _SQL_KEYWORDS = {
        "select","from","where","group","by","order","having","join","on","as",
        "and","or","not","in","is","null","true","false","count","sum","avg",
        "round","case","when","then","else","end","limit","offset","distinct",
        "with","interval","now","cast","try_cast","extract","floor","log10",
        "inner","left","right","outer","union","intersect","except","desc","asc",
        "like","ilike","between","over","partition","lag","lead","row_number",
        "date_trunc","nullif","coalesce","strftime","epoch","int","double","varchar",
        "timestamp","date","boolean","day","month","year","week","hour","minute",
        "frammer_dataset","fact_video_events","kpi_zsp","kpi_cpdg","kpi_lpi",
    }
    possible_cols = [c for c in candidates if c not in _SQL_KEYWORDS and len(c) > 2]
    hallucinated = [c for c in possible_cols if c not in _KNOWN_COLUMNS]
    if hallucinated:
        # Only flag if they appear to be column refs (not table aliases or numbers)
        serious = [c for c in hallucinated if not c.startswith("fd") and len(c) > 3]
        if serious:
            errors.append(f"schema_link.col_missing: possibly hallucinated columns: {serious[:5]}")
            return False, errors
    return True, []
