from fastapi import APIRouter, Depends, Query
from api.db import query_df
from api.filters import FilterParams, build_where_clause

router = APIRouter()


@router.get("/trends/daily")
def daily_trends(days: int = Query(90, ge=7, le=365), f: FilterParams = Depends()):
    where, params = build_where_clause(f, alias="")
    and_clause = " AND" if where else "WHERE"
    df = query_df(
        f"""SELECT
            CAST(TRY_CAST(upload_date AS DATE) AS VARCHAR) AS date,
            COUNT(*) AS uploaded,
            SUM(CASE WHEN published_flag=true THEN 1 ELSE 0 END) AS published,
            COUNT(processed_date) AS processing_count,
            SUM(CASE WHEN published_flag=true THEN 1 ELSE 0 END) AS published_count,
            ROUND(SUM(video_duration_sec)/3600.0,4) AS uploaded_hours,
            ROUND(SUM(CASE WHEN published_flag=true THEN video_duration_sec ELSE 0 END)/3600.0,4) AS published_hours,
            ROUND(SUM(CASE WHEN processed_date IS NOT NULL THEN video_duration_sec ELSE 0 END)/3600.0,4) AS processing_hours
        FROM frammer_dataset
        {where}{and_clause} TRY_CAST(upload_date AS TIMESTAMP) >= NOW() - INTERVAL '{days}' DAY
        GROUP BY 1 ORDER BY 1""",
        params,
    )
    return df.to_dict(orient="records")


@router.get("/trends/category")
def category_trends(f: FilterParams = Depends()):
    where, params = build_where_clause(f, alias="")
    df = query_df(
        f"""SELECT
            input_type AS type,
            COUNT(*) AS count,
            ROUND(SUM(video_duration_sec)/3600.0,4) AS hours,
            ROUND(SUM(CASE WHEN published_flag=true THEN 1 ELSE 0 END)*100.0/COUNT(*),2) AS pcr,
            ROUND(AVG(ctr_percentage),4) AS ctr,
            ROUND(AVG(avg_view_percentage),4) AS avgView
        FROM frammer_dataset
        {where}
        GROUP BY input_type ORDER BY count DESC""",
        params,
    )
    return df.to_dict(orient="records")
