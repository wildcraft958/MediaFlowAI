# Deployment Guide — MediaFlow AI Analytics Dashboard

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Python | 3.11+ | Managed by `uv` |
| Node.js | 18+ | For frontend build |
| uv | latest | `pip install uv` |
| GCP service account | — | Vertex AI + BigQuery access |

---

## 1. Environment Setup

### Python dependencies
```bash
uv sync
```

### Node dependencies
```bash
cd frontend && npm install && cd ..
```

### GCP credentials
The agent layer requires a GCP service account with:
- `roles/aiplatform.user` — Vertex AI (Gemini + embeddings)
- `roles/bigquery.dataEditor` — BigQuery Vector Search

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/your-service-account.json
```

The credentials file is gitignored via `*.json`. Never commit it.

---

## 2. Data Pipeline (run once, or daily via cron)

```bash
# Step 1 — Enrich raw dataset → dataset.csv
uv run python data/enrich.py

# Step 2 — Shift dates so max(upload_date) = today (rolling window alignment)
uv run python data/shift_dates.py

# Step 3 — Build DuckDB star schema + all KPI views
uv run python data/schema.py

# Verify
uv run pytest data/test_enrich.py -v    # 32/32 should pass
```

The raw source dataset (`Corrected_dataset.csv`) must be in the project root for `enrich.py` to run. It is gitignored (sensitive client data).

**To keep the dashboard current:** run `shift_dates.py` + `schema.py` daily (or restart the backend — the DB is loaded at startup).

---

## 3. Development Mode (two terminals)

### Terminal 1 — Backend
```bash
uv run uvicorn api.main:app --reload --port 8000
# API: http://localhost:8000/api/health
# Docs: http://localhost:8000/docs
```

### Terminal 2 — Frontend
```bash
cd frontend
npm run dev
# Dashboard: http://localhost:5173
```

The Vite dev server proxies `/api` requests to `http://localhost:8000` automatically.

---

## 4. Single-Server Mode (demo / submission)

Build the frontend into `frontend/dist/`, then FastAPI serves it directly:

```bash
# Build frontend
cd frontend && npm run build && cd ..

# Start single server
uv run uvicorn api.main:app --port 8000

# Open http://localhost:8000 — React app loads, all API calls go to same origin
```

The SPA catchall in `api/main.py` routes all non-`/api` paths to `frontend/dist/index.html`.

---

## 5. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes | — | Path to GCP service account JSON |
| `VITE_API_URL` | No | `/api` | Override API base URL in frontend |
| `PORT` | No | `8000` | Override backend port |

---

## 6. Full Test Suite

```bash
uv run pytest data/test_enrich.py -v     # 32/32 — data enrichment + ArrowDtype fix
uv run pytest api/test_api.py -v         # 39/39 — all API endpoints (inc. 7 Chronos forecast tests)
uv run pytest agents/test_agents.py -v  # 43/43 — SQL-of-Thought + guardrails + NLQ
```

---

## 7. Health Checks

```bash
# Backend health (should return db_rows: 4569)
curl http://localhost:8000/api/health

# Period comparison (live deltas)
curl http://localhost:8000/api/dashboard/period-comparison | python3 -m json.tool

# Data quality (field completeness)
curl http://localhost:8000/api/dashboard/data-quality | python3 -m json.tool

# Chronos 30-day forecast
curl http://localhost:8000/api/trends/forecast | python3 -m json.tool

# Natural language query (real LLM)
curl -X POST http://localhost:8000/api/nlq \
  -H "Content-Type: application/json" \
  -d '{"question": "Which workspace has the lowest publish rate?", "persona": "leadership"}'
```

---

## 8. GCP Resources

| Resource | Details |
|----------|---------|
| Project | `analytics-prod-123` |
| Region | `us-central1` |
| LLM | Vertex AI — Gemini 2.0 Flash (`gemini-2.0-flash`) |
| Embeddings | Vertex AI — `text-embedding-005` |
| Vector store | BigQuery — `analytics-prod-123.analytics_vectors` |
| Tables | `kpi_embeddings`, `dimension_embeddings` |

---

## 9. Rebuilding the Vector Store

The BigQuery vector store is pre-populated. To rebuild embeddings (e.g., after adding new KPIs):

```bash
uv run python agents/vector_store.py
```

This re-embeds all KPI definitions and dimension values using Vertex AI `text-embedding-005` and writes to BigQuery.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `db_rows: 0` at `/api/health` | `analytics.duckdb` not built | Run `data/schema.py` |
| 500 on `/api/nlq` | GCP credentials not set | Set `GOOGLE_APPLICATION_CREDENTIALS` |
| Frontend shows mock data | Backend not running | Start `uvicorn api.main:app --port 8000` |
| `Corrected_dataset.csv` missing | Raw data not present | Obtain from team lead; place in project root |
| Vector search slow | Cold start, BQ initialization | Normal — first query takes ~5s; subsequent queries are fast |
| `analytics.duckdb` read error | Stale DB from different schema version | Delete `analytics.duckdb` and re-run `data/schema.py` |
| Chronos first-run is slow (~30s) | Model download from HuggingFace Hub | Downloads once, cached in `~/.cache/huggingface/`. Subsequent calls use the cached `lru_cache` pipeline. |

---

## 11. Production Deployment

The recommended production path is **Docker → Google Cloud Run** since the project already uses GCP (Vertex AI, BigQuery).

### 11.1 Dockerfile

Create `Dockerfile` at the project root:

```dockerfile
FROM python:3.11-slim

# System deps for WeasyPrint and Chronos
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 \
    libffi-dev shared-mime-info fonts-liberation curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install uv
RUN pip install uv

# Copy dependency files and install
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Copy source
COPY . .

# Copy pre-built frontend (run `npm run build` before docker build)
# frontend/dist/ must exist at build time
COPY frontend/dist ./frontend/dist

# Expose port
EXPOSE 8080

# Entrypoint: build DB then serve
CMD ["sh", "-c", "uv run python data/enrich.py && uv run python data/shift_dates.py && uv run python data/schema.py && uv run uvicorn api.main:app --host 0.0.0.0 --port 8080"]
```

### 11.2 Build and push

```bash
# 1. Build frontend first (baked into the Docker image)
cd frontend && npm run build && cd ..

# 2. Set your GCP project
export PROJECT_ID=analytics-prod-123
export REGION=us-central1
export IMAGE=gcr.io/$PROJECT_ID/mediaflow-dashboard:latest

# 3. Build Docker image
docker build -t $IMAGE .

# 4. Push to Google Container Registry
gcloud auth configure-docker
docker push $IMAGE
```

### 11.3 Deploy to Cloud Run

```bash
gcloud run deploy mediaflow-dashboard \
  --image $IMAGE \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 2 \
  --timeout 300 \
  --set-secrets GOOGLE_APPLICATION_CREDENTIALS_JSON=mediaflow-sa-key:latest
```

> **Secret setup:** Store the service account JSON as a GCP Secret Manager secret named `mediaflow-sa-key`. The app reads it via the `GOOGLE_APPLICATION_CREDENTIALS` env var. Cloud Run auto-injects it to the filesystem.

Alternatively, attach a service account to the Cloud Run service directly:

```bash
gcloud run services update mediaflow-dashboard \
  --service-account mediaflow-sa@analytics-prod-123.iam.gserviceaccount.com \
  --region $REGION
```

This removes the need to inject a key file — the service account identity is used automatically.

### 11.4 DuckDB persistence caveat

Cloud Run instances are **ephemeral** — the DuckDB file is rebuilt on every cold start (`CMD` in Dockerfile). This is fine for a demo with a fixed dataset. For a production system with live data, move the DB to one of:

| Option | How |
|--------|-----|
| **Cloud Storage** | Mount GCS bucket as FUSE filesystem, point DuckDB at it |
| **MotherDuck** | Replace `analytics.duckdb` local path with `md:mediaflow` connection string |
| **Cloud SQL (PG)** | Replace DuckDB queries with SQLAlchemy + Postgres (larger effort) |

MotherDuck is the lowest-friction path — DuckDB-compatible, zero schema change, cloud-native.

### 11.5 Chronos model caching

The Chronos-Bolt-Tiny model is downloaded from HuggingFace on first startup. On Cloud Run, use a pre-built layer or cache the model in the Docker image:

```dockerfile
# Pre-download Chronos into the image layer (avoids cold-start download)
RUN uv run python -c "from chronos import BaseChronosPipeline; import torch; BaseChronosPipeline.from_pretrained('amazon/chronos-bolt-tiny', device_map='cpu', dtype=torch.float32)"
```

### 11.6 Alternative: Railway / Render

Both support Docker deployments with environment variable injection — no GCP account needed for hosting:

```bash
# Railway
railway up --dockerfile Dockerfile

# Render: connect GitHub repo, set GOOGLE_APPLICATION_CREDENTIALS_JSON env var,
# use the Dockerfile as the build target.
```

Note: You still need GCP credentials for Vertex AI and BigQuery regardless of where the container runs.
