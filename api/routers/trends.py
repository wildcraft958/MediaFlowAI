from __future__ import annotations
import logging
from datetime import date, timedelta
from functools import lru_cache
from fastapi import APIRouter, Depends, Query
from api.db import query_df
from api.filters import FilterParams, build_where_clause

logger = logging.getLogger(__name__)

_MODEL_ID = "amazon/chronos-bolt-tiny"


@lru_cache(maxsize=1)
def _get_chronos_pipeline():
    """Lazy-load Chronos-Bolt-Tiny once, cache for the process lifetime."""
    import torch
    from chronos import BaseChronosPipeline
    logger.info("Loading Chronos model %s …", _MODEL_ID)
    return BaseChronosPipeline.from_pretrained(
        _MODEL_ID,
        device_map="cpu",
        dtype=torch.float32,
    )

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
        FROM media_dataset
        {where}{and_clause} TRY_CAST(upload_date AS TIMESTAMP) >= NOW() - INTERVAL '{days}' DAY
        GROUP BY 1 ORDER BY 1""",
        params,
    )
    return df.to_dict(orient="records")


@router.get("/trends/output-type")
def output_type_trends(f: FilterParams = Depends()):
    """MediaFlow AI output type breakdown — total, published, PCR, avg watch hours."""
    where, params = build_where_clause(f, alias="")
    df = query_df(
        f"""SELECT
            ai_output_type AS type,
            COUNT(*) AS total,
            SUM(CASE WHEN published_flag=true THEN 1 ELSE 0 END) AS published,
            ROUND(SUM(CASE WHEN published_flag=true THEN 1 ELSE 0 END)*100.0/COUNT(*),2) AS pcr,
            ROUND(AVG(CASE WHEN published_flag=true THEN total_watch_time_hours END),2) AS avgWatchHours,
            ROUND(SUM(subscribers_gained),0) AS subscribers,
            ROUND(SUM(TRY_CAST(impressions AS DOUBLE)),0) AS impressions
        FROM media_dataset
        {where}
        GROUP BY ai_output_type ORDER BY total DESC""",
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
        FROM media_dataset
        {where}
        GROUP BY input_type ORDER BY count DESC""",
        params,
    )
    return df.to_dict(orient="records")


@router.get("/trends/forecast")
def upload_forecast(
    days: int = Query(90, ge=30, le=365, description="Historical look-back window"),
    horizon: int = Query(30, ge=7, le=90, description="Forecast horizon in days"),
):
    """
    30-day upload forecast using Chronos-Bolt-Tiny (zero-shot, arXiv:2403.07815).

    Returns historical daily upload counts + forecast quantiles (10th, 50th, 90th percentile).
    Filters are intentionally excluded — forecast is dataset-wide (workspace filters
    create too-sparse time series for reliable zero-shot forecasting).
    """
    import torch
    import numpy as np

    # ── 1. Pull historical daily counts ────────────────────────────────────────
    raw_df = query_df(
        f"""SELECT
            CAST(TRY_CAST(upload_date AS DATE) AS VARCHAR) AS date,
            COUNT(*) AS uploaded
        FROM media_dataset
        WHERE TRY_CAST(upload_date AS TIMESTAMP) >= NOW() - INTERVAL '{days}' DAY
          AND upload_date IS NOT NULL
        GROUP BY 1 ORDER BY 1""",
        [],
    )

    # ── 2. Fill date gaps with 0 (continuous series required by Chronos) ───────
    if len(raw_df) == 0:
        return {"history": [], "forecast": [], "model": _MODEL_ID}

    try:
        first_date = date.fromisoformat(raw_df["date"].iloc[0])
        last_date = date.fromisoformat(raw_df["date"].iloc[-1])
    except (ValueError, TypeError):
        return {"history": [], "forecast": [], "model": _MODEL_ID}
    all_dates = [first_date + timedelta(days=i) for i in range((last_date - first_date).days + 1)]
    date_map = dict(zip(raw_df["date"], raw_df["uploaded"].astype(int)))
    history_counts = [date_map.get(str(d), 0) for d in all_dates]

    # ── 3. Run Chronos-Bolt-Tiny ───────────────────────────────────────────────
    pipeline = _get_chronos_pipeline()
    context = torch.tensor([history_counts], dtype=torch.float32)
    quantiles, _ = pipeline.predict_quantiles(
        context,
        prediction_length=horizon,
        quantile_levels=[0.1, 0.5, 0.9],
    )
    # quantiles shape: [1, horizon, 3]
    q = quantiles[0].numpy()  # (horizon, 3)
    low = np.maximum(q[:, 0], 0).round().astype(int).tolist()
    median = np.maximum(q[:, 1], 0).round().astype(int).tolist()
    high = np.maximum(q[:, 2], 0).round().astype(int).tolist()

    # ── 4. Build forecast date range (day after last history date) ─────────────
    forecast_dates = [str(last_date + timedelta(days=i + 1)) for i in range(horizon)]

    return {
        "history": [
            {"date": str(d), "uploaded": c}
            for d, c in zip(all_dates, history_counts)
        ],
        "forecast": [
            {"date": fd, "low": lo, "median": med, "high": hi}
            for fd, lo, med, hi in zip(forecast_dates, low, median, high)
        ],
        "model": _MODEL_ID,
    }
