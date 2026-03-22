"""
Insights API — ambient AI insights and alert endpoints.
"""
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional
from api.insights import (
    get_insights,
    get_unread_count,
    mark_read,
    dismiss_insight,
    generate_insights,
)

router = APIRouter()


class MarkReadRequest(BaseModel):
    id: Optional[int] = None  # None = mark all as read


@router.get("/insights")
def list_insights(
    limit: int = Query(20, ge=1, le=100),
    type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    unread_only: bool = Query(False),
):
    items = get_insights(
        limit=limit, type_filter=type, severity_filter=severity, unread_only=unread_only
    )
    return {"insights": items, "total": len(items)}


@router.get("/insights/count")
def insights_count():
    return {"unread": get_unread_count()}


@router.post("/insights/mark-read")
def mark_insights_read(req: MarkReadRequest):
    mark_read(req.id)
    return {"ok": True}


@router.post("/insights/dismiss/{insight_id}")
def dismiss(insight_id: int):
    dismiss_insight(insight_id)
    return {"ok": True}


@router.post("/insights/generate")
def trigger_generate():
    new = generate_insights()
    return {"generated": len(new), "insights": new}
