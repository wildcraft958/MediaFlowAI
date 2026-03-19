import json
from typing import Literal, Optional
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from api.models import NLQRequest, NLQResponse, HITLResumeRequest

router = APIRouter()


class NLQStreamRequest(BaseModel):
    """POST body for /nlq/stream — supports page_context and chart_context."""
    question: str = Field(..., min_length=1, max_length=2000)
    session_id: str = Field("default", pattern=r"^[a-zA-Z0-9_\-]{1,64}$")
    persona: Literal["leadership", "creator"] = "leadership"
    page_context: Optional[dict] = None
    chart_context: Optional[dict] = None


@router.post("/nlq", response_model=NLQResponse)
async def nlq(body: NLQRequest):
    """Blocking NLQ endpoint — full graph invocation via ainvoke."""
    try:
        from agents.qna_agent import run_qna_agent
        result = await run_qna_agent(
            query=body.question,
            session_id=body.session_id,
            persona=body.persona,
            filters=body.filters,
            page_context=body.page_context,
            chart_context=body.chart_context,
        )
        return NLQResponse(
            answer=result.get("narrative", ""),
            sql=result.get("sql"),
            data=result.get("result"),
            thought_process=_fmt_thought_steps(result.get("thought_steps", [])),
        )
    except ImportError:
        return NLQResponse(
            answer="Agent layer is not yet available. Install all dependencies and restart.",
            thought_process="Import failed",
        )
    except Exception as e:
        return NLQResponse(answer=f"Agent error: {e}", thought_process=str(e))


@router.get("/nlq/stream")
async def nlq_stream(
    question: str = Query(..., max_length=2000, min_length=1),
    session_id: str = Query("default", pattern=r"^[a-zA-Z0-9_\-]{1,64}$"),
    persona: Literal["leadership", "creator"] = Query("leadership"),
):
    """
    SSE streaming NLQ endpoint.
    Emits thought_step, sql_ready, final, and done events as the graph runs.

    Usage:
      const source = new EventSource('/api/nlq/stream?question=PCR+by+workspace')
      source.onmessage = (e) => console.log(JSON.parse(e.data))
    """
    async def generator():
        try:
            from agents.qna_agent import stream_qna_agent
            async for event in stream_qna_agent(
                query=question,
                session_id=session_id,
                persona=persona,
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except ImportError:
            yield f'data: {json.dumps({"type": "error", "message": "Agent layer unavailable"})}\n\n'
        except Exception as e:
            yield f'data: {json.dumps({"type": "error", "message": str(e)})}\n\n'
        finally:
            yield 'data: {"type":"done"}\n\n'

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/nlq/stream")
async def nlq_stream_post(body: NLQStreamRequest):
    """
    POST SSE streaming NLQ endpoint — supports page_context and chart_context.
    Use this when sending context that doesn't fit in GET query params.
    """
    async def generator():
        try:
            from agents.qna_agent import stream_qna_agent
            async for event in stream_qna_agent(
                query=body.question,
                session_id=body.session_id,
                persona=body.persona,
                page_context=body.page_context,
                chart_context=body.chart_context,
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except ImportError:
            yield f'data: {json.dumps({"type": "error", "message": "Agent layer unavailable"})}\n\n'
        except Exception as e:
            yield f'data: {json.dumps({"type": "error", "message": str(e)})}\n\n'
        finally:
            yield 'data: {"type":"done"}\n\n'

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/nlq/hitl/resume", response_model=NLQResponse)
async def hitl_resume(body: HITLResumeRequest):
    """
    Resume a HITL-paused graph after human approval/rejection.

    Call this after the graph paused at hitl_node with an alert payload.
    body.decision: "approve" fires the alert via fire_alert MCP tool.
    body.decision: "reject" skips firing and goes to narrate.
    """
    try:
        from langgraph.types import Command
        from agents.qna_agent import _graph

        result = await _graph.ainvoke(
            Command(resume=body.decision),
            config={"configurable": {"thread_id": body.session_id}},
        )
        return NLQResponse(
            answer=result.get("narrative", f"Alert {body.decision}ed."),
            sql=result.get("sql"),
            data=result.get("result"),
            thought_process=_fmt_thought_steps(result.get("thought_steps", [])),
        )
    except Exception as e:
        return NLQResponse(answer=f"HITL resume error: {e}", thought_process=str(e))


def _fmt_thought_steps(steps: list) -> str:
    if not steps:
        return ""
    return "\n".join(
        f"[{s.get('node','')}] {s.get('action','')} — {s.get('detail','')}"
        for s in steps
    )
