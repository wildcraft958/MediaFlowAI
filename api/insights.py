"""
Ambient Insight Engine — generates proactive insights from KPI data.

Runs periodically via background scheduler. Insights are persisted in DuckDB
and served via /api/insights endpoints.
"""
from __future__ import annotations
import math
from api.db import query_df, query_one, rw_execute, rw_execute_many, safe_float as _safe_float, safe_int as _safe_int


def _next_id() -> int:
    row = query_one("SELECT COALESCE(MAX(id), 0) + 1 FROM insights")
    return row[0] if row else 1


def _insert_insight(insight: dict):
    """Insert a single insight into the insights table."""
    rw_execute(
        """
        INSERT INTO insights (id, type, severity, title, body, kpi, workspace, value, threshold)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            insight["id"],
            insight["type"],
            insight["severity"],
            insight["title"],
            insight["body"],
            insight.get("kpi"),
            insight.get("workspace"),
            insight.get("value"),
            insight.get("threshold"),
        ],
    )


def seed_insights():
    """Pre-populate insights from actual KPI data for demo. Only runs if table is empty."""
    existing = query_one("SELECT COUNT(*) FROM insights")
    if existing and existing[0] > 0:
        return  # Already seeded

    # Gather real data for seeded insights
    pcr_data = query_df(
        "SELECT workspace, "
        "ROUND(SUM(CASE WHEN published_flag=true THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS pcr, "
        "COUNT(*) AS total, "
        "SUM(CASE WHEN published_flag=true THEN 1 ELSE 0 END) AS published "
        "FROM media_dataset GROUP BY workspace ORDER BY pcr"
    )

    worst_ws = pcr_data.iloc[0] if len(pcr_data) > 0 else None
    best_ws = pcr_data.iloc[-1] if len(pcr_data) > 0 else None

    # Missing upload_date count
    missing_row = query_one("SELECT COUNT(*) FROM media_dataset WHERE upload_date IS NULL")
    missing_count = missing_row[0] if missing_row else 0
    total_row = query_one("SELECT COUNT(*) FROM media_dataset")
    total_count = total_row[0] if total_row else 1
    missing_pct = round(missing_count * 100.0 / total_count, 1)

    # Orphaned hours for worst workspace
    orphan_row = None
    if worst_ws is not None:
        orphan_row = query_one(
            "SELECT ROUND(SUM(video_duration_sec/3600.0),1) "
            "FROM media_dataset "
            "WHERE published_flag = false AND workspace = ?",
            [worst_ws["workspace"]],
        )
    orphan_hours = _safe_float(orphan_row[0]) if orphan_row else 0

    # Output type distribution
    output_df = query_df(
        "SELECT ai_output_type, COUNT(*) AS cnt "
        "FROM media_dataset WHERE ai_output_type IS NOT NULL "
        "GROUP BY ai_output_type ORDER BY cnt DESC"
    )
    top_output = output_df.iloc[0] if len(output_df) > 0 else None
    top_output_pct = (
        round(top_output["cnt"] * 100.0 / output_df["cnt"].sum(), 0)
        if top_output is not None
        else 0
    )

    # Weekly upload growth
    weekly_df = query_df(
        "SELECT DATE_TRUNC('week', TRY_CAST(upload_date AS TIMESTAMP)) AS wk, COUNT(*) AS cnt "
        "FROM media_dataset WHERE upload_date IS NOT NULL "
        "GROUP BY wk ORDER BY wk DESC LIMIT 2"
    )
    wow_growth = 0
    if len(weekly_df) >= 2:
        cur, prev = _safe_int(weekly_df.iloc[0]["cnt"]), _safe_int(weekly_df.iloc[1]["cnt"])
        if prev > 0:
            wow_growth = round((cur - prev) * 100.0 / prev, 0)

    seeds: list[dict] = []
    next_id = 1

    if worst_ws is not None:
        stuck = _safe_int(worst_ws["total"]) - _safe_int(worst_ws["published"])
        seeds.append(
            {
                "id": next_id,
                "type": "alert",
                "severity": "warning",
                "title": f"Low PCR Alert: {worst_ws['workspace']}",
                "body": f"PCR at {_safe_float(worst_ws['pcr'])}% - {stuck} videos stuck in pipeline.",
                "kpi": "PCR",
                "workspace": worst_ws["workspace"],
                "value": _safe_float(worst_ws["pcr"]),
                "threshold": 50.0,
            }
        )
        next_id += 1

    if best_ws is not None:
        seeds.append(
            {
                "id": next_id,
                "type": "insight",
                "severity": "success",
                "title": f"Top Performer: {best_ws['workspace']}",
                "body": (
                    f"PCR at {_safe_float(best_ws['pcr'])}% with "
                    f"{_safe_int(best_ws['published'])} published videos - highest conversion rate."
                ),
                "kpi": "PCR",
                "workspace": best_ws["workspace"],
                "value": _safe_float(best_ws["pcr"]),
            }
        )
        next_id += 1

    if missing_count > 0:
        seeds.append(
            {
                "id": next_id,
                "type": "anomaly",
                "severity": "warning",
                "title": "Data Quality Gap",
                "body": (
                    f"{missing_count} videos ({missing_pct}%) are missing "
                    "upload_date - impacts MCI calculations."
                ),
                "kpi": "MCI",
                "value": missing_pct,
            }
        )
        next_id += 1

    if best_ws is not None:
        seeds.append(
            {
                "id": next_id,
                "type": "insight",
                "severity": "info",
                "title": "Publish Spike Detected",
                "body": (
                    f"{best_ws['workspace']} published {_safe_int(best_ws['published'])} "
                    "videos - leading all workspaces by volume."
                ),
                "kpi": "FSC",
                "workspace": best_ws["workspace"],
            }
        )
        next_id += 1

    if orphan_hours > 0 and worst_ws is not None:
        seeds.append(
            {
                "id": next_id,
                "type": "alert",
                "severity": "warning",
                "title": "Orphaned Content Alert",
                "body": (
                    f"{worst_ws['workspace']} has {orphan_hours}h of unpublished "
                    "video content awaiting review."
                ),
                "kpi": "OPI",
                "workspace": worst_ws["workspace"],
                "value": orphan_hours,
                "threshold": 48.0,
            }
        )
        next_id += 1

    if top_output is not None:
        seeds.append(
            {
                "id": next_id,
                "type": "insight",
                "severity": "info",
                "title": "Output Type Trend",
                "body": (
                    f"{top_output['ai_output_type']} is the most common AI output type "
                    f"({int(top_output_pct)}% of all processed videos)."
                ),
                "kpi": "AIL",
            }
        )
        next_id += 1

    seeds.append(
        {
            "id": next_id,
            "type": "insight",
            "severity": "success",
            "title": "Growth Signal",
            "body": (
                f"Upload volume {'up' if wow_growth >= 0 else 'down'} "
                f"{abs(wow_growth)}% week-over-week across all workspaces."
            ),
            "kpi": "GR",
            "value": wow_growth,
        }
    )
    next_id += 1

    seeds.append(
        {
            "id": next_id,
            "type": "insight",
            "severity": "info",
            "title": "Forecast Available",
            "body": (
                "30-day Chronos-Bolt-Tiny forecast predicts stable upload volume "
                "with confidence bands available on Usage & Trends page."
            ),
        }
    )

    _INSERT_SQL = (
        "INSERT INTO insights (id, type, severity, title, body, kpi, workspace, value, threshold) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    rw_execute_many([
        (_INSERT_SQL, [
            s["id"], s["type"], s["severity"], s["title"], s["body"],
            s.get("kpi"), s.get("workspace"), s.get("value"), s.get("threshold"),
        ])
        for s in seeds
    ])


def generate_insights() -> list[dict]:
    """
    Generate fresh insights from current KPI data.
    Called periodically by the background scheduler.
    Returns list of new insights created.
    """
    new_insights = []
    next_id = _next_id()

    # Check PCR thresholds across workspaces
    pcr_data = query_df(
        "SELECT workspace, "
        "ROUND(SUM(CASE WHEN published_flag=true THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS pcr, "
        "COUNT(*) AS total, "
        "SUM(CASE WHEN published_flag=true THEN 1 ELSE 0 END) AS published "
        "FROM media_dataset GROUP BY workspace"
    )

    for _, row in pcr_data.iterrows():
        pcr = _safe_float(row["pcr"])
        if pcr < 50:
            stuck = _safe_int(row["total"]) - _safe_int(row["published"])
            insight = {
                "id": next_id,
                "type": "alert",
                "severity": "warning",
                "title": f"Low PCR: {row['workspace']}",
                "body": f"Publish conversion at {pcr}% - {stuck} videos not yet published.",
                "kpi": "PCR",
                "workspace": row["workspace"],
                "value": pcr,
                "threshold": 50.0,
            }
            _insert_insight(insight)
            new_insights.append(insight)
            next_id += 1

    return new_insights


def get_insights(
    limit: int = 20,
    type_filter: str = None,
    severity_filter: str = None,
    unread_only: bool = False,
) -> list[dict]:
    """Fetch insights from the database."""
    conditions = ["dismissed = false"]
    params: list = []
    if type_filter:
        conditions.append("type = ?")
        params.append(type_filter)
    if severity_filter:
        conditions.append("severity = ?")
        params.append(severity_filter)
    if unread_only:
        conditions.append("read = false")

    where = " AND ".join(conditions)
    df = query_df(
        f"SELECT * FROM insights WHERE {where} ORDER BY created_at DESC LIMIT ?",
        params + [limit],
    )
    if len(df) == 0:
        return []
    # Replace NaN/NaT with None for JSON serialization
    records = df.to_dict(orient="records")
    for rec in records:
        for k, v in rec.items():
            try:
                if v is not None and math.isnan(v):
                    rec[k] = None
            except (TypeError, ValueError):
                pass
    return records


def get_unread_count() -> int:
    """Return count of unread, non-dismissed insights."""
    row = query_one("SELECT COUNT(*) FROM insights WHERE read = false AND dismissed = false")
    return row[0] if row else 0


def mark_read(insight_id: int = None):
    """Mark a specific insight as read, or all if id is None."""
    if insight_id is not None:
        rw_execute("UPDATE insights SET read = true WHERE id = ?", [insight_id])
    else:
        rw_execute("UPDATE insights SET read = true WHERE read = false")


def dismiss_insight(insight_id: int):
    """Dismiss an insight (soft delete)."""
    rw_execute("UPDATE insights SET dismissed = true WHERE id = ?", [insight_id])
