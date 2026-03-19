from fastapi import APIRouter
from api.db import query_one
from api.models import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health():
    db_rows = query_one("SELECT COUNT(*) FROM media_dataset")[0]
    db_tables = query_one(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'main'"
    )[0]
    return HealthResponse(status="ok", db_rows=db_rows, db_tables=db_tables)
