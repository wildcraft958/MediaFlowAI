# Frammer AI — Analytics Dashboard

**IIT General Championship · Data Analytics 2026**
Industry Partner: Frammer AI | Competition Track: Data Analytics

---

## What This Is

A full-stack, AI-powered analytics dashboard for Frammer AI's B2B media operations platform. Frammer AI ingests raw video uploads (interviews, debates, news bulletins, etc.) and uses AI to generate structured outputs (key moments, chapters, summaries, full packages) published to YouTube Shorts and Instagram Reels.

The dashboard answers: *Which workspaces publish efficiently? Where is video getting stuck? What does the AI produce that actually reaches audiences?*

**Live capabilities:** natural language querying via LangGraph agent, SQL-of-Thought pipeline, BigQuery vector search, period-over-period comparisons, real-time data quality monitoring.

---

## Key Numbers (authoritative — from enriched dataset, seed=42)

| Metric | Value |
|--------|-------|
| Total videos | 4,569 |
| Uploaded (valid upload\_date) | 4,179 (91.5%) |
| AI Processed | 4,179 (100% of uploaded) |
| Published | 3,188 (69.8% overall) |
| PCR range | 38% (WS-SPORTS-LIVE) → 92% (WS-DIGITAL-NEWS) |
| Billable | 3,188 (69.8%) / Non-billable: 1,381 (30.2%) |
| Workspaces | 5 (Company\_A × 4, Company\_B × 1) |
| Users | content\_editor\_01 → content\_editor\_04 |
| Languages | English (72%), Hindi (28%) |
| Data health | 84.5% overall field completeness |

---

## Project Structure

```
GCAgent/
├── data/
│   ├── frammer_dataset.csv      ← Source of truth (4,569 rows, seed=42)
│   ├── enrich.py                ← Reproducible 8-transform enrichment pipeline
│   ├── shift_dates.py           ← Shifts dates so max(upload_date)=today
│   ├── schema.py                ← DuckDB star schema + 16 KPI views
│   ├── test_enrich.py           ← 32 TDD tests (all pass)
│   ├── ASSUMPTIONS.md           ← All data decisions with PS rationale
│   └── DIMENSION_DICT.md        ← PS mandatory deliverable
├── kpis/
│   ├── KPI_FINAL.md             ← 19 Phase-1 KPIs with DuckDB formulas
│   └── KPI_CATALOG.md           ← All 35 KPIs including Phase 2+
├── config/
│   ├── metric_registry.yaml     ← 19 KPIs: type, view, page, persona
│   ├── dimensions.yaml          ← Dimension registry with cardinality
│   └── clients/CLIENT_1.yaml   ← Thresholds, enabled KPIs, alert channels
├── api/
│   ├── main.py                  ← FastAPI app + static SPA serving
│   ├── db.py                    ← Read-only DuckDB singleton
│   ├── filters.py               ← FilterParams + safe WHERE builder
│   ├── routers/
│   │   ├── dashboard.py         ← /executive /publish-funnel /period-comparison /data-quality /users
│   │   ├── kpis.py              ← /kpis/{acronym}
│   │   ├── trends.py            ← /trends/daily /trends/category /trends/output-type
│   │   ├── crosstab.py          ← /crosstab (D1×D2 heatmap, metric=count|hours|pcr_pct)
│   │   ├── videos.py            ← /videos (paginated) + /videos/export (CSV)
│   │   ├── admin.py             ← KPI CRUD + KPI chatbot (Gemini)
│   │   └── nlq.py               ← /nlq + /nlq/stream (SSE)
│   └── test_api.py              ← 32 TDD tests (all pass)
├── agents/
│   ├── qna_agent.py             ← LangGraph 4-node orchestrator
│   ├── graph_state.py           ← AgentState TypedDict
│   ├── middleware.py            ← Input/output/tool guardrail nodes
│   ├── vector_store.py          ← BigQuery Vector Search (kpi_embeddings)
│   ├── mcp_servers/
│   │   ├── kpi_server.py        ← FastMCP: run_kpi_query, list_kpis
│   │   ├── alert_server.py      ← FastMCP: check_thresholds, fire_alert
│   │   └── report_server.py     ← FastMCP: generate_client_brief (PDF)
│   ├── text2sql/
│   │   ├── schema_linker.py     ← NL → DuckDB columns (Gemini 2.0 Flash)
│   │   ├── query_planner.py     ← CoT SQL plan generation
│   │   ├── sql_generator.py     ← DuckDB SQL from plan
│   │   ├── guardrails.py        ← DDL/DML block + PG-cast block + LLM validation
│   │   └── correction_loop.py   ← Scratchpad-aware retry (max 2)
│   ├── test_agents.py           ← 43 TDD tests (all pass)
│   └── PLAN.md                  ← LangGraph architecture + MCP integration
├── frontend/
│   └── src/
│       ├── pages/               ← 6 dashboard tabs
│       ├── components/          ← Charts, layout, NLQ panel, FilterBar
│       ├── store/useStore.js    ← Zustand global state (metric, filters, persona)
│       └── api/client.js        ← Axios API client (all endpoints)
├── PPT.md                       ← Presentation script (Step 7 — slides 1-12)
├── Agent.md                     ← Agent system design, personas, extensibility
├── DEPLOYMENT.md                ← Single-server + dev deployment guide
└── CLAUDE.md                    ← Project instructions (gitignored)
```

---

## Completion Status

| Step | Status | Detail |
|------|--------|--------|
| 1 — Data enrichment | ✅ | 4,569 rows, 8 transforms, 32/32 TDD tests, seed=42 |
| 2 — KPI design | ✅ | 19 Phase-1 KPIs, YAML registry, 35-KPI catalog |
| 3 — DuckDB schema | ✅ | Star schema, 16 SQL views, 3 Python KPI tables, 4 agg tables |
| 4 — FastAPI backend | ✅ | 14 endpoints, period-comparison, data-quality, 32/32 tests |
| 5 — Agent layer | ✅ | LangGraph 4-node, SQL-of-Thought, MCP, SSE, HITL, 43/43 tests |
| 6 — Frontend | ✅ | 6 tabs + NLQ panel, live API, COUNT↔HOURS, D1×D2 CrossTab |
| 7 — Insights deck | 🔲 | Script in PPT.md — needs export to PDF/PPT (10 marks) |
| 8 — Predictive layer | 🔲 | Bonus: Chronos forecast + River anomaly detection |

---

## Dashboard Tabs

| Tab | Key Content | KPIs Shown |
|-----|-------------|------------|
| Executive Summary | PCR headline, 3-stage funnel, data quality monitor, workspace bars, period deltas | PCR, OPI, AGV, MCI |
| Usage & Trends | 90-day upload/publish, category breakdown, workspace hours, weekly aggregates | GR, AIL, TEU |
| Team Activity | Treemap, user table, D1×D2 CrossTab heatmap (COUNT/HOURS/PCR), LPI | TEU, OPI, LPI, DCDR |
| Publish Metrics | Conversion bars, output mix donut, CPDG scatter, HTHR leaderboard | FSC, CPDG, SAC, AHY, EDR, HTHR, TSQI, PIG |
| Video Explorer | Searchable paginated table, ZSP badges, filters, CSV export | ZSP, CPDG |
| Admin | AI KPI chatbot (Gemini), KPI registry CRUD, client config | All 19 |

**Global controls:** COUNT↔HOURS toggle · Persona switcher (Leadership/Creator) · Agent Inbox (HITL) · Workspace/language/date filters

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | DB status, row count |
| `GET /api/dashboard/executive` | PCR, funnel, workspace PCR, 30-day trend |
| `GET /api/dashboard/period-comparison` | Current vs previous period deltas |
| `GET /api/dashboard/data-quality` | Field completeness, health score, duplicate rate |
| `GET /api/dashboard/publish-funnel` | 3-stage funnel (count + hours) |
| `GET /api/dashboard/users` | Per-user activity summary |
| `GET /api/kpis/{acronym}` | Single KPI result (PCR, FSC, ZSP, etc.) |
| `GET /api/trends/daily` | 90-day daily upload/publish |
| `GET /api/trends/category` | By input type |
| `GET /api/trends/output-type` | By Frammer output type |
| `GET /api/crosstab` | D1×D2 heatmap (`metric=count\|hours\|pcr_pct`) |
| `GET /api/videos` | Paginated video list |
| `GET /api/videos/export` | CSV download |
| `GET /api/dimensions` | Valid filter values |
| `POST /api/nlq` | Natural language query (full response) |
| `GET /api/nlq/stream` | SSE streaming NLQ |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Data pipeline | Python + pandas + numpy (seed=42) |
| Storage | DuckDB (`frammer.duckdb`) |
| DB MCP | mcp-server-motherduck |
| Custom MCP | FastMCP (kpi\_server, alert\_server, report\_server) |
| Backend | FastAPI (Python) |
| Agent framework | LangGraph + LangChain |
| MCP bridge | langchain-mcp-adapters |
| NLQ pipeline | SQL-of-Thought (arXiv:2509.00581) |
| LLM | Gemini 2.0 Flash — Vertex AI (`langchain-google-vertexai`) |
| Embeddings | Vertex AI `text-embedding-005` |
| Vector store | BigQuery Vector Search (`agrowise-192e3.frammer_vectors`) |
| GCP project | `agrowise-192e3`, region `us-central1` |
| Frontend | React (Vite) + Tailwind CSS |
| Charts | Apache ECharts (`echarts-for-react`) |
| State | Zustand |
| Animation | Framer Motion |
| Icons | Lucide React |

---

## Quick Setup

See **`DEPLOYMENT.md`** for full instructions. TL;DR:

```bash
# 1. Install deps
uv sync
cd frontend && npm install && cd ..

# 2. Build dataset
uv run python data/enrich.py
uv run python data/shift_dates.py
uv run python data/schema.py

# 3. Set GCP credentials
export GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# 4. Start (development — two terminals)
uv run uvicorn api.main:app --reload --port 8000
cd frontend && npm run dev   # http://localhost:5173

# 5. Start (single server — after npm run build)
cd frontend && npm run build && cd ..
uv run uvicorn api.main:app --port 8000   # http://localhost:8000
```

---

## Test Suite

```bash
uv run pytest data/test_enrich.py -v     # 32/32 — data enrichment
uv run pytest api/test_api.py -v         # 32/32 — API endpoints
uv run pytest agents/test_agents.py -v  # 43/43 — agent pipeline
```

---

## Workspace Publish Variance (core insight)

```
WS-DIGITAL-NEWS    ████████████████████ 92%  ← Company_B, top performer
WS-ENTERTAINMENT   ████████████████     82%
WS-TECH-ANALYSIS   █████████████        68%
WS-LIFESTYLE       ██████████           52%
WS-SPORTS-LIVE     ███████              38%  ← 557 videos stuck (investigation target)
```

This 54-percentage-point gap is the central data story. Every dashboard tab is designed to explain and explore why it exists — input type mix, processing time, user activity, output type choices.
