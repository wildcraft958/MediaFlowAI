"""
Frammer AI Analytics — FastAPI backend
Run from project root:  uv run uvicorn api.main:app --reload --port 8000
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.db import get_db
from api.routers import health, dimensions, dashboard, kpis, trends, crosstab, videos, admin, nlq


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up DB connection
    get_db()
    yield
    # Nothing to close — singleton connection lives for the process lifetime


app = FastAPI(
    title="Frammer AI Analytics API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers — all under /api prefix
for r in [health, dimensions, dashboard, kpis, trends, crosstab, videos, admin, nlq]:
    app.include_router(r.router, prefix="/api")
