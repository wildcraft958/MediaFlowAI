from fastapi import APIRouter, Depends
from api.db import query_df, query_one
from api.filters import FilterParams, build_where_clause

router = APIRouter()


@router.get("/dashboard/executive")
def executive(f: FilterParams = Depends()):
    where, params = build_where_clause(f, alias="")

    # PCR total
    pcr_row = query_one(
        f"SELECT ROUND(SUM(CASE WHEN published_flag=true THEN 1 ELSE 0 END)*100.0/COUNT(*),1) FROM frammer_dataset {where}",
        params,
    )
    pcr_total = float(pcr_row[0]) if pcr_row and pcr_row[0] is not None else 0.0

    # Funnel counts
    funnel_row = query_one(
        f"""SELECT
            COUNT(*) FILTER (WHERE upload_date IS NOT NULL),
            COUNT(*) FILTER (WHERE processed_date IS NOT NULL),
            COUNT(*) FILTER (WHERE published_flag=true)
        FROM frammer_dataset {where}""",
        params,
    )
    funnel = {
        "uploaded": int(funnel_row[0]),
        "processed": int(funnel_row[1]),
        "published": int(funnel_row[2]),
    }

    # PCR by workspace
    ws_df = query_df(
        f"""SELECT frammer_workspace AS workspace,
               COUNT(*) AS total,
               SUM(CASE WHEN published_flag=true THEN 1 ELSE 0 END) AS published,
               ROUND(SUM(CASE WHEN published_flag=true THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS pcr
        FROM frammer_dataset {where}
        GROUP BY frammer_workspace ORDER BY pcr DESC""",
        params,
    )
    workspace_pcr = ws_df.to_dict(orient="records")

    # 30-day trend
    trend_where = where + (" AND" if where else "WHERE")
    trend_df = query_df(
        f"""SELECT
            CAST(TRY_CAST(upload_date AS DATE) AS VARCHAR) AS date,
            COUNT(*) AS uploaded,
            SUM(CASE WHEN published_flag=true THEN 1 ELSE 0 END) AS published,
            ROUND(SUM(video_duration_sec)/3600.0,4) AS uploaded_hours,
            ROUND(SUM(CASE WHEN published_flag=true THEN video_duration_sec ELSE 0 END)/3600.0,4) AS published_hours
        FROM frammer_dataset
        {trend_where} TRY_CAST(upload_date AS TIMESTAMP) >= NOW() - INTERVAL '30 days'
        GROUP BY 1 ORDER BY 1""",
        params,
    )

    return {
        "pcr_total": pcr_total,
        "funnel": funnel,
        "workspace_pcr": workspace_pcr,
        "trend": trend_df.to_dict(orient="records"),
    }


@router.get("/dashboard/publish-funnel")
def publish_funnel(f: FilterParams = Depends()):
    where, params = build_where_clause(f, alias="")
    row = query_one(
        f"""SELECT
            COUNT(*) FILTER (WHERE upload_date IS NOT NULL),
            SUM(CASE WHEN upload_date IS NOT NULL THEN video_duration_sec ELSE 0 END)/3600.0,
            COUNT(*) FILTER (WHERE processed_date IS NOT NULL),
            SUM(CASE WHEN processed_date IS NOT NULL THEN video_duration_sec ELSE 0 END)/3600.0,
            COUNT(*) FILTER (WHERE published_flag=true),
            SUM(CASE WHEN published_flag=true THEN video_duration_sec ELSE 0 END)/3600.0
        FROM frammer_dataset {where}""",
        params,
    )
    uploaded, up_h, processed, pr_h, published, pub_h = row
    total = uploaded or 1
    return [
        {"name": "Uploaded",  "count": int(uploaded),  "hours": round(float(up_h),2),  "pct": 100.0},
        {"name": "Processed", "count": int(processed), "hours": round(float(pr_h),2),  "pct": round(processed/total*100,1)},
        {"name": "Published", "count": int(published), "hours": round(float(pub_h),2), "pct": round(published/total*100,1)},
    ]
