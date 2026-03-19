"""Pydantic response models."""
from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    db_rows: int
    db_tables: int


class FunnelStage(BaseModel):
    name: str
    count: int
    hours: float
    pct: float


class WorkspacePCR(BaseModel):
    workspace: str
    total: int
    published: int
    pcr: float


class TrendPoint(BaseModel):
    date: str
    uploaded: int
    published: int
    uploaded_hours: float
    published_hours: float


class ExecutiveSummaryResponse(BaseModel):
    pcr_total: float
    funnel: dict[str, int]
    workspace_pcr: list[WorkspacePCR]
    trend: list[TrendPoint]


class CategoryPoint(BaseModel):
    type: str
    count: int
    hours: float
    pcr: float
    ctr: float
    avgView: float


class VideoRow(BaseModel):
    id: str
    headline: str
    workspace: str
    inputType: str
    outputType: Optional[str]
    durationMin: float
    durationSec: float
    durationH: float
    durationM: float
    published: bool
    platform: Optional[str]
    uploadedBy: str
    uploadDate: Optional[str]
    zsp: Optional[float]
    team: str
    language: str


class VideosResponse(BaseModel):
    data: list[VideoRow]
    total: int
    page: int
    pageSize: int


class KPIChatRequest(BaseModel):
    message: str
    history: list[dict[str, str]] = []


class KPIChatResponse(BaseModel):
    explanation: Optional[str] = None
    yaml: Optional[str] = None
    showAddButton: bool = False


class NLQRequest(BaseModel):
    question: str
    filters: dict[str, Any] = {}
    context: Optional[str] = None
    session_id: str = "default"
    persona: str = "leadership"


class NLQResponse(BaseModel):
    answer: str
    sql: Optional[str] = None
    data: Optional[Any] = None
    thought_process: Optional[str] = None
