from fastapi import APIRouter
from api.db import query_one
from api.models import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health():
    row = query_one("SELECT COUNT(*) FROM media_dataset")
    db_rows = int(row[0]) if row and row[0] is not None else 0
    tbl_row = query_one(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'main'"
    )
    db_tables = int(tbl_row[0]) if tbl_row and tbl_row[0] is not None else 0
    return HealthResponse(status="ok", db_rows=db_rows, db_tables=db_tables)
