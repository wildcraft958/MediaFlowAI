"""
MediaFlow AI Analytics — FastAPI backend
Run from project root:  uv run uvicorn api.main:app --reload --port 8000
"""
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from api.db import get_db
from api.routers import health, dimensions, dashboard, kpis, trends, crosstab, videos, admin, nlq


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up DB connection (pre-built at Docker image build time)
    get_db()
    yield
    # Nothing to close — singleton connection lives for the process lifetime


app = FastAPI(
    title="MediaFlow AI Analytics API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers — all under /api prefix
for r in [health, dimensions, dashboard, kpis, trends, crosstab, videos, admin, nlq]:
    app.include_router(r.router, prefix="/api")

# Static file serving for production (npm run build → frontend/dist/)
_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=str(_DIST / "assets")), name="static")

    @app.get("/{path:path}")
    async def spa_catchall(path: str):
        return FileResponse(str(_DIST / "index.html"))
