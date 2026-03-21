"""Pydantic response models."""
from __future__ import annotations
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field


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
    question: str = Field(..., min_length=1, max_length=2000)
    filters: dict[str, Any] = Field(default_factory=dict)
    context: Optional[str] = Field(None, max_length=500)
    session_id: str = Field("default", pattern=r"^[a-zA-Z0-9_\-]{1,64}$")
    persona: Literal["leadership", "creator"] = "leadership"
    page_context: Optional[dict] = None      # {page, filters, kpis, chart_titles}
    chart_context: Optional[dict] = None     # {title, data, image_base64}


class NLQResponse(BaseModel):
    answer: str
    sql: Optional[str] = None
    data: Optional[Any] = None
    chart_spec: Optional[dict] = None
    thought_process: Optional[str] = None


class NLQStreamEvent(BaseModel):
    type: str       # "thought_step"|"sql_ready"|"result_ready"|"final"|"error"|"done"
    node: Optional[str] = None
    data: Optional[Any] = None
    answer: Optional[str] = None
    sql: Optional[str] = None
    chart_spec: Optional[dict] = None
    row_count: Optional[int] = None
    message: Optional[str] = None


class HITLResumeRequest(BaseModel):
    session_id: str = Field(..., pattern=r"^[a-zA-Z0-9_\-]{1,64}$")
    decision: Literal["approve", "reject"]
    message: Optional[str] = Field(None, max_length=500)
