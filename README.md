# Frammer AI - Product Usage Analytics Dashboard

**General Championship 2026 - Data Analytics | Industry Case Partner: Frammer AI**

**Live Dashboard:** [mediaflow-dashboard-779023846662.us-central1.run.app](https://mediaflow-dashboard-779023846662.us-central1.run.app/)

---

## Problem Statement

Frammer AI converts long-form video into short-form, publish-ready outputs for media teams. The existing analytics dashboard lacks multi-dimensional drill-downs, natural language querying, and visibility into where content gets stuck between upload, AI processing, and publish.

Three questions every head of content needs answered:
1. What percentage of uploaded videos actually reach publish?
2. Where is the drop-off -- upload, AI processing, or editorial review?
3. Which AI output formats drive the most published content?

## Solution

A 6-tab analytics dashboard with a conversational AI agent that answers these questions in English, not SQL.

**Core Insight:** Publish Conversion Rate (PCR) varies from **38% to 92%** across workspaces -- a 54-point gap that drives every dashboard view.

```
WS-DIGITAL-NEWS    ████████████████████ 92%   1,106 published
WS-ENTERTAINMENT   ████████████████     82%     725 published
WS-TECH-ANALYSIS   █████████████        68%     810 published
WS-LIFESTYLE       ██████████           52%     206 published
WS-SPORTS-LIVE     ███████              38%     341 published  <- 557 videos stuck
```

---

## Dashboard Pages

| # | Tab | PS Objective | What it answers |
|---|-----|-------------|-----------------|
| 1 | **Executive Summary** | 6A, 6C | Overall funnel health, period-over-period trends, workspace PCR comparison |
| 2 | **Usage & Trends** | 6A, 6B | Upload volume over time, category breakdown, 30-day Chronos forecast |
| 3 | **Team Activity** | 6D | Who uploads what, D1 x D2 CrossTab heatmaps, user productivity |
| 4 | **Publish Metrics** | 6B, 6C | Workspace conversion rates, output type mix, content-to-publish gap |
| 5 | **Video Explorer** | 6D, 6E | Searchable video-level detail with filters and CSV export |
| 6 | **Admin** | All | NLQ chatbot, KPI registry management, client configuration |

**Cross-cutting features:**
- COUNT / HOURS toggle on all metric views
- 4-role RBAC (admin, cxo, manager, analyst) with per-KPI visibility
- Multi-tenant support (CLIENT_1 / CLIENT_2) via YAML config
- D1 x D2 CrossTab heatmap (e.g. Workspace x Input Type)
- Ambient AI insights with proactive alerts and notification bell
- Responsive layout (desktop, tablet, mobile)

---

## Natural Language Query Agent

Users ask questions in plain English via a floating NLQ panel. The system handles SQL generation, result narration, and chart rendering automatically.

**Pipeline (4-node LangGraph graph):**

```
User question
    |
[Input Guardrail] -- PII redaction, injection detection
    |
[Router] -- LLM classifier: GREETING | KPI_DEF | STANDARD_KPI | AD_HOC | CONTEXT_AWARE
    |                    |
[Analytics Agent]   [Text2SQL Engine]
    |                    |
    |              schema link -> query plan -> SQL gen -> guardrails -> correction loop
    |                    |
[Narrate] -- LLM-generated markdown insight + chart spec
    |
SSE stream to frontend
```

**Text2SQL safeguards:** DDL/DML block, timestamp cast validation, boolean normalization, 50k char SQL cap, 5k row result cap, 30s execution timeout.

**Vector search:** BigQuery Vector Search with Vertex AI embeddings (text-embedding-005) for KPI/dimension semantic retrieval.

---

## Ambient Insights & Alert Engine

The dashboard proactively generates AI-driven insights and threshold-based alerts without user interaction.

**How it works:**
- On startup, the engine queries all 19 KPIs against live DuckDB data and seeds 8 insights
- A background scheduler regenerates alerts every 30 minutes
- The notification bell in the top nav polls for new insights every 60 seconds
- Admins can manually trigger generation via `POST /api/insights/generate`

**Insight types:**
| Type | Example | Trigger |
|------|---------|---------|
| **Threshold alert** | "WS-SPORTS-LIVE PCR at 38% - 557 videos stuck" | PCR drops below configured minimum |
| **Data quality anomaly** | "390 videos (8.5%) missing upload_date" | MCI field completeness check |
| **Performance insight** | "WS-DIGITAL-NEWS leads at 92% PCR" | Top/bottom workspace comparison |
| **Trend signal** | "Upload volume up 11% WoW" | Week-over-week growth calculation |

**API endpoints:** `GET /api/insights`, `GET /api/insights/count`, `POST /api/insights/mark-read`, `POST /api/insights/dismiss/{id}`, `POST /api/insights/generate`

**Alert thresholds** are configurable from the Admin tab (PCR minimum, orphaned hours cap, MCI floor, anomaly z-score).

---

## Architecture

```
data/dataset.csv (4,569 rows, 29 cols)
        |
data/schema.py --> analytics.duckdb (star schema + 16 KPI views + 4 agg tables)
        |
FastMCP servers (kpi_server, alert_server, report_server)
        |
LangGraph QnA Agent (Router --> Analytics | Text2SQL --> Narrate)
        |
FastAPI backend (16 endpoints under /api/*)
        |
React + Tailwind frontend (6 tabs + NLQ panel)
```

| Layer | Technology |
|-------|-----------|
| Data pipeline | Python, pandas, numpy (seed=42, fully reproducible) |
| Storage | DuckDB -- star schema, 9 dimension tables, 16 KPI views, 4 pre-aggregated tables |
| Backend | FastAPI, 10 router modules, 20+ endpoints |
| Agent framework | LangGraph + LangChain, SQL-of-Thought pattern |
| LLM | Gemini 2.0 Flash via Vertex AI |
| Embeddings | Vertex AI text-embedding-005 |
| Vector search | BigQuery Vector Search |
| MCP tools | FastMCP (kpi_server, alert_server, report_server) |
| Frontend | React 18 (Vite) + Tailwind CSS + Apache ECharts + Zustand |
| Forecasting | Chronos-Bolt-Tiny (9M params, zero-shot, 30-day horizon) |
| Deployment | Google Cloud Run |

---

## Data Model

**Star schema** built from an enriched dataset of 4,569 video events across 2 companies, 5 workspaces, 4 users, 7 input types, and 5 AI output types.

**3-stage funnel (PS 6C):**
```
Uploaded (upload_date not null): 4,179
        | 100% processed by Frammer AI
Processed (processed_date not null): 4,179
        | varies 38-92% by workspace
Published (published_flag=True): 3,188
```

**19 KPIs** across 5 problem statement objectives:

| PS Section | KPIs | What they measure |
|------------|-------|-------------------|
| 6A - Usage & Adoption | TEU, AGV, PMI, GR | Upload volume, video duration, growth trends |
| 6B - Output Mix & Trends | AIL, CPDG, CRM, SAC, AHY, EDR, HTHR | AI processing patterns, content-to-publish gaps |
| 6C - Publishing Funnel | PCR, FSC | Conversion rates, funnel stage completion |
| 6D - Team/User/Platform | LPI, ZSP, TSQI, PIG | User productivity, zero-second detection, quality |
| 6E - Data Quality | MCI, DCDR | Missing field completeness, data coverage |

Full KPI definitions with DuckDB/Python formulas: [`kpis/KPI_FINAL.md`](kpis/KPI_FINAL.md)
Complete 35-KPI catalog: [`kpis/KPI_CATALOG.md`](kpis/KPI_CATALOG.md)
Metric registry: [`config/metric_registry.yaml`](config/metric_registry.yaml) -- new KPIs added without code change.

---

## Extensibility (PS 8C)

New KPIs, dimensions, and client tenants are added through configuration, not code:

| What to add | How | File |
|-------------|-----|------|
| New KPI | Add YAML entry with view name, type, page, roles | `config/metric_registry.yaml` |
| New dimension | Add to dimension registry | `config/dimensions.yaml` |
| New client tenant | Add client config directory | `config/clients/` |
| New dashboard filter | FilterBar reads dimensions.yaml automatically | `config/dimensions.yaml` |

---

## Data Quality (PS 8D)

Two dedicated KPIs monitor data health:
- **MCI (Missing Completeness Index):** Field-by-field null/unknown percentage across the dataset
- **DCDR (Data Coverage & Duplication Rate):** Duplicate video_id detection, coverage by workspace

Executive Summary shows data quality bars per field. 390 rows with null upload_date are tracked and excluded from funnel calculations with full documentation in [`data/ASSUMPTIONS.md`](data/ASSUMPTIONS.md).

---

## Deliverables Checklist (PS 7)

| Deliverable | Status | Location |
|-------------|--------|----------|
| Working dashboard (3-5 pages) | 6 tabs, live at Cloud Run URL | `frontend/src/pages/` |
| Natural language query interface | NLQ panel with SSE streaming | `agents/qna_agent.py`, `api/routers/nlq.py` |
| Vector search / semantic retrieval | BigQuery Vector Search | `agents/vector_store.py` |
| Metric dictionary | 19 KPIs with formulas | `kpis/KPI_FINAL.md` |
| Dimension dictionary | 10 dimensions with cardinality | `data/DIMENSION_DICT.md` |
| Data model (star schema) | 9 dim tables + fact view | `data/schema.py` |
| Assumptions documented | All decisions with PS references | `data/ASSUMPTIONS.md` |
| Ambient insights & alerts | Proactive AI insights with threshold alerts | `api/insights.py`, `api/routers/insights.py` |
| Code + build notes | This README + deployment guide | `DEPLOYMENT.md` |

---

## Project Structure

```
.
├── data/                        # Data pipeline
│   ├── dataset.csv              # Source of truth (4,569 rows, seed=42)
│   ├── enrich.py                # Reproducible enrichment (7 transforms)
│   ├── shift_dates.py           # Rolling window date alignment
│   ├── schema.py                # DuckDB star schema + KPI views
│   ├── test_enrich.py           # 32 TDD tests
│   ├── ASSUMPTIONS.md           # Data decisions with PS rationale
│   └── DIMENSION_DICT.md        # Dimension dictionary
├── kpis/                        # KPI definitions
│   ├── KPI_FINAL.md             # 19 Phase-1 KPIs with formulas
│   └── KPI_CATALOG.md           # Full 35-KPI catalog
├── config/                      # YAML-driven configuration
│   ├── metric_registry.yaml     # KPI metadata (type, view, page, roles)
│   ├── dimensions.yaml          # Dimension registry
│   └── clients/                 # Multi-tenant client configs (CLIENT_1, CLIENT_2)
├── api/                         # FastAPI backend
│   ├── main.py                  # App entry, CORS, SPA serving
│   ├── db.py                    # DuckDB connection (read-only, thread-safe)
│   ├── llm.py                   # Vertex AI client (Gemini 2.0 Flash)
│   ├── insights.py              # Ambient insight engine (seed, generate, query)
│   ├── routers/                 # health, dashboard, kpis, trends, crosstab, videos, admin, nlq, insights
│   └── test_api.py              # 52 TDD tests
├── agents/                      # LangGraph QnA agent
│   ├── qna_agent.py             # 4-node graph (router, interpret, execute, narrate)
│   ├── middleware.py            # Input/output/tool guardrails
│   ├── vector_store.py          # BigQuery Vector Search
│   ├── text2sql/                # SQL-of-Thought: schema_linker, query_planner, sql_generator, guardrails, correction_loop
│   ├── mcp_servers/             # FastMCP: kpi_server, alert_server, report_server
│   └── test_agents.py           # 43 TDD tests
├── frontend/                    # React (Vite) + Tailwind CSS
│   └── src/
│       ├── pages/               # 6 dashboard tabs + login + landing
│       ├── components/          # Charts, layout, NLQ panel, FilterBar
│       └── store/               # Zustand state management
├── Dockerfile                   # Cloud Run deployment (pre-built artifacts)
└── DEPLOYMENT.md                # Setup, dev mode, and Cloud Run deploy guide
```

---

## Setup

```bash
# Install dependencies
uv sync
cd frontend && npm install && cd ..

# Build dataset + DuckDB
uv run python data/enrich.py
uv run python data/shift_dates.py
uv run python data/schema.py

# Set GCP credentials (required for Vertex AI + BigQuery)
export GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# Development (two terminals)
uv run uvicorn api.main:app --reload --port 8000     # backend
cd frontend && npm run dev                             # frontend dev server

# Production (single server)
cd frontend && npm run build && cd ..
uv run uvicorn api.main:app --port 8000
```

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for Cloud Run deployment instructions.

---

## Tests

```
Data enrichment:  32/32 pass   (data/test_enrich.py)
API endpoints:    59/59 pass   (api/test_api.py)
Agent pipeline:   43/43 pass   (agents/test_agents.py)
─────────────────────────────────────────────────────
Total:           134/134 TDD tests
```

```bash
uv run pytest data/test_enrich.py api/test_api.py agents/test_agents.py -v
```

---

## Scoring Alignment (PS 10)

| Criteria | Weight | How we address it |
|----------|--------|-------------------|
| Business understanding & KPI design | 20 | 19 KPIs mapped to PS sections 6A-6E, YAML metric registry, 3-stage funnel, PCR variance as central data story |
| Dashboard UX & navigability | 20 | 6 tabs with overview-to-detail flow, COUNT/HOURS toggle, D1xD2 CrossTab, 4-role RBAC with per-KPI access control, notification bell, responsive layout |
| Analytical depth & insight quality | 20 | LangGraph NLQ agent with SQL-of-Thought and guardrails, vector search, multi-turn memory, SSE streaming, Chronos 30-day forecast, ambient AI insights engine |
| Data quality checks & correctness | 15 | MCI + DCDR KPIs, 390 null-upload rows tracked, ZSP zero-second detection, field completeness scoring, 134 TDD tests |
| Scalability / extensibility | 15 | YAML metric registry (add KPIs without code), config-driven multi-tenant clients, FastMCP tool layer, dimension registry |
| Presentation & communication | 10 | Workspace PCR variance narrative (38-92%), funnel drop-off story, AI-generated insight summaries |
