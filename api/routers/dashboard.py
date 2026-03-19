from fastapi import APIRouter, Depends, Query
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

    # PCR by workspace (includes total_hours for StorageMetrics)
    ws_df = query_df(
        f"""SELECT frammer_workspace AS workspace,
               COUNT(*) AS total,
               SUM(CASE WHEN published_flag=true THEN 1 ELSE 0 END) AS published,
               ROUND(SUM(CASE WHEN published_flag=true THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS pcr,
               ROUND(SUM(video_duration_sec)/3600.0,2) AS total_hours
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


@router.get("/dashboard/users")
def user_activity(f: FilterParams = Depends()):
    """User activity summary — uploaded, published, PCR, approx processing time per user."""
    where, params = build_where_clause(f, alias="")
    df = query_df(
        f"""SELECT
            uploaded_by AS user,
            team_name AS team,
            frammer_workspace AS workspace,
            COUNT(*) AS uploaded,
            SUM(CASE WHEN published_flag=true THEN 1 ELSE 0 END) AS published,
            ROUND(SUM(CASE WHEN published_flag=true THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS pcr,
            ROUND(AVG(
                CASE WHEN processed_date IS NOT NULL AND upload_date IS NOT NULL
                THEN (epoch(TRY_CAST(processed_date AS TIMESTAMP)) -
                      epoch(TRY_CAST(upload_date AS TIMESTAMP))) / 3600.0
                END
            ), 1) AS teu,
            MAX(CAST(TRY_CAST(upload_date AS DATE) AS VARCHAR)) AS lastActive
        FROM frammer_dataset {where}
        GROUP BY uploaded_by, team_name, frammer_workspace
        ORDER BY uploaded DESC""",
        params,
    )
    records = df.to_dict(orient="records")
    for r in records:
        r["status"] = "active" if (r.get("pcr") or 0) >= 60 else "idle"
    return records


@router.get("/dashboard/period-comparison")
def period_comparison(period_days: int = Query(30, ge=7, le=180), f: FilterParams = Depends()):
    where, params = build_where_clause(f, alias="")
    and_clause = " AND" if where else "WHERE"
    df = query_df(f"""
        WITH boundaries AS (
            SELECT
                NOW() - INTERVAL '{period_days}' DAY AS mid,
                NOW() - INTERVAL '{period_days * 2}' DAY AS start_dt
        )
        SELECT
            SUM(CASE WHEN TRY_CAST(upload_date AS TIMESTAMP) >= b.mid THEN 1 ELSE 0 END) AS cur_uploaded,
            SUM(CASE WHEN TRY_CAST(upload_date AS TIMESTAMP) >= b.mid AND published_flag=true THEN 1 ELSE 0 END) AS cur_published,
            SUM(CASE WHEN TRY_CAST(upload_date AS TIMESTAMP) < b.mid AND TRY_CAST(upload_date AS TIMESTAMP) >= b.start_dt THEN 1 ELSE 0 END) AS prev_uploaded,
            SUM(CASE WHEN TRY_CAST(upload_date AS TIMESTAMP) < b.mid AND TRY_CAST(upload_date AS TIMESTAMP) >= b.start_dt AND published_flag=true THEN 1 ELSE 0 END) AS prev_published,
            ROUND(AVG(CASE WHEN TRY_CAST(upload_date AS TIMESTAMP) >= b.mid AND processed_date IS NOT NULL
                THEN (epoch(TRY_CAST(processed_date AS TIMESTAMP)) - epoch(TRY_CAST(upload_date AS TIMESTAMP))) / 3600.0 END), 1) AS cur_avg_proc_h,
            ROUND(AVG(CASE WHEN TRY_CAST(upload_date AS TIMESTAMP) < b.mid AND TRY_CAST(upload_date AS TIMESTAMP) >= b.start_dt AND processed_date IS NOT NULL
                THEN (epoch(TRY_CAST(processed_date AS TIMESTAMP)) - epoch(TRY_CAST(upload_date AS TIMESTAMP))) / 3600.0 END), 1) AS prev_avg_proc_h
        FROM frammer_dataset, boundaries b
        {where}{and_clause} TRY_CAST(upload_date AS TIMESTAMP) >= b.start_dt
    """, params)
    row = df.iloc[0].to_dict() if len(df) > 0 else {}

    def delta(cur, prev):
        if prev and prev > 0:
            return round((cur - prev) / prev * 100, 1)
        return None

    cu = int(row.get('cur_uploaded') or 0)
    cp = int(row.get('cur_published') or 0)
    pu = int(row.get('prev_uploaded') or 0)
    pp = int(row.get('prev_published') or 0)
    cur_pcr = round(cp / cu * 100, 1) if cu > 0 else 0
    prev_pcr = round(pp / pu * 100, 1) if pu > 0 else 0
    cur_proc = row.get('cur_avg_proc_h')
    prev_proc = row.get('prev_avg_proc_h')
    return {
        "current": {"uploaded": cu, "published": cp, "pcr": cur_pcr, "avg_processing_h": cur_proc},
        "previous": {"uploaded": pu, "published": pp, "pcr": prev_pcr, "avg_processing_h": prev_proc},
        "delta": {
            "uploaded_pct": delta(cu, pu),
            "published_pct": delta(cp, pp),
            "pcr_pct": round(cur_pcr - prev_pcr, 1) if pu > 0 else None,
            "avg_processing_pct": delta(float(cur_proc or 0), float(prev_proc or 0)),
        },
    }


@router.get("/dashboard/data-quality")
def data_quality(f: FilterParams = Depends()):
    where, params = build_where_clause(f, alias="")
    df = query_df(f"""SELECT
        COUNT(*) AS total,
        COUNT(upload_date) AS upload_date_nn,
        COUNT(processed_date) AS processed_date_nn,
        COUNT(billable_flag) AS billable_nn,
        COUNT(output_type) AS output_type_nn,
        COUNT(published_platform) AS platform_nn
    FROM frammer_dataset {where}""", params)
    row = df.iloc[0]
    total = int(row['total'])
    fields = [
        {"field": "upload_date", "filled": int(row['upload_date_nn']),
         "null": total - int(row['upload_date_nn']),
         "pct": round(int(row['upload_date_nn']) / total * 100, 1)},
        {"field": "processed_date", "filled": int(row['processed_date_nn']),
         "null": total - int(row['processed_date_nn']),
         "pct": round(int(row['processed_date_nn']) / total * 100, 1)},
        {"field": "billable_flag", "filled": int(row['billable_nn']),
         "null": total - int(row['billable_nn']),
         "pct": round(int(row['billable_nn']) / total * 100, 1)},
        {"field": "output_type", "filled": int(row['output_type_nn']),
         "null": total - int(row['output_type_nn']),
         "pct": round(int(row['output_type_nn']) / total * 100, 1)},
        {"field": "published_platform", "filled": int(row['platform_nn']),
         "null": total - int(row['platform_nn']),
         "pct": round(int(row['platform_nn']) / total * 100, 1)},
    ]
    avg_health = round(sum(f["pct"] for f in fields) / len(fields), 1)
    dup_df = query_df("SELECT total_records, duplicate_count, dcdr_pct FROM v_dcdr", [])
    dup = dup_df.iloc[0].to_dict() if len(dup_df) > 0 else {}
    return {
        "total_rows": total,
        "fields": fields,
        "overall_health_pct": avg_health,
        "duplicate_pct": float(dup.get("dcdr_pct") or 0),
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
