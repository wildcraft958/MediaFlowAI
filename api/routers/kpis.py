import math
from fastapi import APIRouter, HTTPException, Depends
from api.db import query_df
from api.config import METRIC_REGISTRY
from api.filters import FilterParams

router = APIRouter()


def _sanitize_records(records):
    """Replace NaN/Inf with None for JSON compliance."""
    clean = []
    for row in records:
        r = {}
        for k, v in row.items():
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                r[k] = None
            else:
                r[k] = v
        clean.append(r)
    return clean

# KPIs that need aggregation before serving to the frontend
_AGGREGATED_QUERIES = {
    "CPDG": """
        SELECT
            m.input_type,
            COUNT(*) AS count,
            ROUND(AVG(c.cpdg), 4) AS avg_cpdg,
            ROUND(AVG(m.ctr_percentage), 2) AS ctr_percentage,
            ROUND(AVG(m.avg_view_percentage), 2) AS avg_view_percentage
        FROM kpi_cpdg c
        JOIN media_dataset m ON c.video_id = m.video_id
        GROUP BY m.input_type
        ORDER BY avg_cpdg DESC
    """,
    "HTHR": """
        SELECT
            input_type,
            ROUND(AVG((ctr_percentage * avg_view_percentage) * log10(CAST(impressions AS DOUBLE))), 4) AS hthr_score,
            ROUND(AVG(ctr_percentage), 4) AS ctr_percentage,
            ROUND(AVG(avg_view_percentage), 4) AS avg_view_percentage,
            ROUND(SUM(TRY_CAST(impressions AS DOUBLE)), 0) AS impressions
        FROM media_dataset
        WHERE published_flag = true AND CAST(impressions AS DOUBLE) > 0
        GROUP BY input_type
        ORDER BY hthr_score DESC
    """,
    "LPI": """
        SELECT
            language,
            ROUND(AVG(total_watch_time_hours), 2) AS avg_watch_hours,
            COUNT(*) AS count,
            ROUND(SUM(CASE WHEN published_flag=true THEN 1 ELSE 0 END)*100.0/COUNT(*), 1) AS pcr,
            ROUND(
                (SUM(CASE WHEN published_flag=true THEN 1 ELSE 0 END)*100.0/COUNT(*))
                - (SELECT SUM(CASE WHEN published_flag=true THEN 1 ELSE 0 END)*100.0/COUNT(*) FROM media_dataset)
            , 4) AS lpi_score
        FROM media_dataset
        GROUP BY language
        ORDER BY lpi_score DESC
    """,
}


@router.get("/kpis/{acronym}")
def get_kpi(acronym: str, f: FilterParams = Depends()):
    kpi = METRIC_REGISTRY.get(acronym.upper())
    if not kpi:
        raise HTTPException(status_code=404, detail=f"KPI '{acronym}' not found")

    # Some KPIs need aggregated queries instead of raw view data
    agg_sql = _AGGREGATED_QUERIES.get(acronym.upper())
    if agg_sql:
        try:
            df = query_df(agg_sql)
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"KPI aggregation failed: {e}")
        return {"acronym": acronym.upper(), "data": _sanitize_records(df.to_dict(orient="records"))}

    # View/table name comes from trusted YAML - never user input
    source = kpi.get("view") or kpi.get("table")
    if not source:
        raise HTTPException(status_code=500, detail="KPI has no view or table defined")

    try:
        df = query_df(f"SELECT * FROM {source}")
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"KPI source '{source}' not available: {e}")
    return {"acronym": acronym.upper(), "data": _sanitize_records(df.to_dict(orient="records"))}


@router.get("/kpis")
def list_kpis():
    """Return metadata for all KPIs in the registry."""
    result = []
    for i, (acronym, kpi) in enumerate(METRIC_REGISTRY.items()):
        result.append({
            "id": i + 1,
            "acronym": acronym,
            "name": kpi.get("name", ""),
            "type": kpi.get("type", "sql"),
            "page": kpi.get("dashboard_page", ""),
            "enabled": True,
            "description": kpi.get("description", ""),
            "personas": kpi.get("personas", []),
            "roles": kpi.get("roles", []),
        })
    return result
