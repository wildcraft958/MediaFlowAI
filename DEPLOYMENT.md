# Deployment Guide — Frammer AI Analytics Dashboard

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
# Step 1 — Enrich raw dataset → frammer_dataset.csv
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
uv run pytest api/test_api.py -v         # 32/32 — all API endpoints
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

# Natural language query (real LLM)
curl -X POST http://localhost:8000/api/nlq \
  -H "Content-Type: application/json" \
  -d '{"question": "Which workspace has the lowest publish rate?", "persona": "leadership"}'
```

---

## 8. GCP Resources

| Resource | Details |
|----------|---------|
| Project | `agrowise-192e3` |
| Region | `us-central1` |
| LLM | Vertex AI — Gemini 2.0 Flash (`gemini-2.0-flash`) |
| Embeddings | Vertex AI — `text-embedding-005` |
| Vector store | BigQuery — `agrowise-192e3.frammer_vectors` |
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
| `db_rows: 0` at `/api/health` | `frammer.duckdb` not built | Run `data/schema.py` |
| 500 on `/api/nlq` | GCP credentials not set | Set `GOOGLE_APPLICATION_CREDENTIALS` |
| Frontend shows mock data | Backend not running | Start `uvicorn api.main:app --port 8000` |
| `Corrected_dataset.csv` missing | Raw data not present | Obtain from team lead; place in project root |
| Vector search slow | Cold start, BQ initialization | Normal — first query takes ~5s; subsequent queries are fast |
| `frammer.duckdb` read error | Stale DB from different schema version | Delete `frammer.duckdb` and re-run `data/schema.py` |
