from fastapi import APIRouter
from api.models import NLQRequest, NLQResponse

router = APIRouter()

# Step 4 stub — replaced by run_qna_agent() in Step 5
@router.post("/nlq", response_model=NLQResponse)
async def nlq(body: NLQRequest):
    try:
        from agents.qna_agent import run_qna_agent
        result = await run_qna_agent(
            query=body.question,
            session_id=body.session_id,
            persona=body.persona,
            filters=body.filters,
        )
        return NLQResponse(
            answer=result.get("narrative", ""),
            sql=result.get("sql"),
            data=result.get("result"),
            thought_process=_fmt_thought_steps(result.get("thought_steps", [])),
        )
    except ImportError:
        return NLQResponse(
            answer="Agent layer (Step 5) is not yet available. Start the server after installing all dependencies.",
            thought_process="Step 5 pending",
        )
    except Exception as e:
        return NLQResponse(answer=f"Agent error: {e}", thought_process=str(e))


def _fmt_thought_steps(steps: list) -> str:
    if not steps:
        return ""
    return "\n".join(f"[{s.get('node','')}] {s.get('action','')} — {s.get('detail','')}" for s in steps)
