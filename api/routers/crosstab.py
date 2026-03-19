from fastapi import APIRouter, Depends, Query, HTTPException
from api.db import query_df
from api.config import CROSSTAB_ALLOWED_COLUMNS
from api.filters import FilterParams, build_where_clause

router = APIRouter()


@router.get("/crosstab")
def crosstab(
    d1: str = Query(..., description="Row dimension key from dimensions.yaml"),
    d2: str = Query(..., description="Column dimension key from dimensions.yaml"),
    f: FilterParams = Depends(),
):
    # Validate against allowlist — never interpolate raw user input
    if d1 not in CROSSTAB_ALLOWED_COLUMNS:
        raise HTTPException(status_code=400, detail=f"d1='{d1}' not allowed. Choose from: {list(CROSSTAB_ALLOWED_COLUMNS)}")
    if d2 not in CROSSTAB_ALLOWED_COLUMNS:
        raise HTTPException(status_code=400, detail=f"d2='{d2}' not allowed. Choose from: {list(CROSSTAB_ALLOWED_COLUMNS)}")

    d1_col = CROSSTAB_ALLOWED_COLUMNS[d1]
    d2_col = CROSSTAB_ALLOWED_COLUMNS[d2]

    where, params = build_where_clause(f, alias="")

    # Raw pivot data — columns come from trusted allowlist
    df = query_df(
        f"""SELECT
            {d1_col} AS d1_val,
            {d2_col} AS d2_val,
            COUNT(*) AS count,
            ROUND(SUM(video_duration_sec)/3600.0,4) AS hours,
            ROUND(SUM(CASE WHEN published_flag=true THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS pcr_pct
        FROM media_dataset
        {where}
        GROUP BY 1, 2 ORDER BY 1, 2""",
        params,
    )

    if df.empty:
        return []

    # Pivot: one row per d1_val, columns are d2 values
    metric = f.metric if f.metric in ("count", "hours", "pcr_pct") else "count"
    pivot = df.pivot_table(
        index="d1_val", columns="d2_val", values=metric, fill_value=0
    ).reset_index()
    pivot.columns.name = None
    return pivot.to_dict(orient="records")
