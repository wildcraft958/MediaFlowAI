import io
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from api.db import query_df, query_one
from api.filters import FilterParams, build_where_clause

router = APIRouter()

_VIDEO_COLS = """
    fd.video_id         AS id,
    fd.headline,
    fd.workspace AS workspace,
    fd.input_type        AS inputType,
    fd.output_type       AS outputType,
    ROUND(fd.video_duration_sec / 60.0, 2)  AS durationMin,
    fd.video_duration_sec                    AS durationSec,
    FLOOR(fd.video_duration_sec / 3600)      AS durationH,
    FLOOR((fd.video_duration_sec % 3600) / 60) AS durationM,
    fd.published_flag    AS published,
    fd.published_platform AS platform,
    fd.uploaded_by       AS uploadedBy,
    CAST(TRY_CAST(fd.upload_date AS DATE) AS VARCHAR) AS uploadDate,
    kz.zsp               AS zsp,
    fd.team_name         AS team,
    fd.language
"""

_BASE_QUERY = """
    FROM media_dataset fd
    LEFT JOIN kpi_zsp kz ON fd.video_id = kz.video_id
"""


def _build_video_where(f: FilterParams, search: str | None) -> tuple[str, list]:
    where, params = build_where_clause(f, alias="fd")
    if search:
        clause = "fd.headline ILIKE ?"
        params.append(f"%{search}%")
        where = (where + " AND " + clause) if where else ("WHERE " + clause)
    return where, params


_SORTABLE_COLUMNS = {
    "headline": "fd.headline",
    "workspace": "fd.workspace",
    "inputType": "fd.input_type",
    "input_type": "fd.input_type",
    "outputType": "fd.output_type",
    "output_type": "fd.output_type",
    "durationMin": "fd.video_duration_sec",
    "video_duration_sec": "fd.video_duration_sec",
    "published": "fd.published_flag",
    "uploadedBy": "fd.uploaded_by",
    "uploaded_by": "fd.uploaded_by",
    "uploadDate": "fd.upload_date",
    "upload_date": "fd.upload_date",
    "zsp": "kz.zsp",
}


@router.get("/videos")
def videos(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    search: str | None = Query(None),
    sort_by: str | None = Query(None),
    sort_dir: str = Query("desc"),
    f: FilterParams = Depends(),
):
    where, params = _build_video_where(f, search)
    offset = (page - 1) * limit

    total_row = query_one(
        f"SELECT COUNT(*) FROM media_dataset fd {where}",
        params,
    )
    total = int(total_row[0]) if total_row and total_row[0] is not None else 0

    # Build ORDER BY from whitelist
    direction = "ASC" if sort_dir.lower() == "asc" else "DESC"
    sort_col = _SORTABLE_COLUMNS.get(sort_by)
    if sort_col:
        order_clause = f"ORDER BY {sort_col} {direction} NULLS LAST"
    else:
        order_clause = "ORDER BY TRY_CAST(fd.upload_date AS TIMESTAMP) DESC NULLS LAST"

    df = query_df(
        f"SELECT {_VIDEO_COLS} {_BASE_QUERY} {where} "
        f"{order_clause} "
        f"LIMIT {limit} OFFSET {offset}",
        params,
    )

    # Replace NaN/Inf with None for JSON compliance
    import math, numpy as np
    df = df.where(df.notna(), other=None)
    # Convert numpy float types to Python float, replace inf
    records = []
    for row in df.to_dict(orient="records"):
        clean = {}
        for k, v in row.items():
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                clean[k] = None
            elif isinstance(v, (np.integer,)):
                clean[k] = int(v)
            elif isinstance(v, (np.floating,)):
                clean[k] = None if (math.isnan(float(v)) or math.isinf(float(v))) else float(v)
            else:
                clean[k] = v
        records.append(clean)

    return {
        "data": records,
        "total": total,
        "page": page,
        "pageSize": limit,
    }


@router.get("/videos/export")
def export_videos(
    search: str | None = Query(None),
    f: FilterParams = Depends(),
):
    where, params = _build_video_where(f, search)
    df = query_df(
        f"SELECT {_VIDEO_COLS} {_BASE_QUERY} {where} "
        f"ORDER BY TRY_CAST(fd.upload_date AS TIMESTAMP) DESC NULLS LAST",
        params,
    )
    buf = io.StringIO()
    df = df.fillna("")
    df.to_csv(buf, index=False)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=mediaflow_videos.csv"},
    )
