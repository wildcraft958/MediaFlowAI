from fastapi import APIRouter, HTTPException, Depends
from api.db import query_df
from api.config import METRIC_REGISTRY
from api.filters import FilterParams

router = APIRouter()


@router.get("/kpis/{acronym}")
def get_kpi(acronym: str, f: FilterParams = Depends()):
    kpi = METRIC_REGISTRY.get(acronym.upper())
    if not kpi:
        raise HTTPException(status_code=404, detail=f"KPI '{acronym}' not found")

    # View/table name comes from trusted YAML — never user input
    source = kpi.get("view") or kpi.get("table")
    if not source:
        raise HTTPException(status_code=500, detail="KPI has no view or table defined")

    df = query_df(f"SELECT * FROM {source}")
    return {"acronym": acronym.upper(), "data": df.to_dict(orient="records")}


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
        })
    return result
