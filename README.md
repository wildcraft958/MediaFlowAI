# Frammer AI — Analytics Dashboard

**IIT General Championship · Data Analytics 2026**
Industry Partner: Frammer AI | Problem Statement: Section 6, 7, 9

---

## What This Is

A full-stack analytics dashboard for Frammer AI's B2B media operations platform. Frammer AI processes raw video uploads (interviews, debates, news bulletins, etc.) into AI-generated output formats (key moments, chapters, summaries) and publishes them to YouTube Shorts and Instagram Reels.

The dashboard answers: *Which workspaces are publishing efficiently? Where is video getting stuck? What does the AI produce that actually gets published?*

---

## Key Numbers (authoritative — from enriched dataset)

| Metric | Value |
|--------|-------|
| Total videos | 4,569 |
| Uploaded (valid upload_date) | 4,179 (91.5%) |
| AI Processed | 4,179 (100% of uploaded) |
| Published | 3,188 (69.8% overall) |
| PCR range across workspaces | 38% (WS-SPORTS-LIVE) → 92% (WS-DIGITAL-NEWS) |
| Workspaces | 5 (Company_A × 4, Company_B × 1) |
| Users | content_editor_01 → content_editor_04 |
| Languages | English (72%), Hindi (28%) |

---

## Project Structure

```
GCAgent/
├── data/
│   ├── frammer_dataset.csv      ← Source of truth (4,569 rows, seed=42)
│   ├── enrich.py                ← Reproducible enrichment pipeline
│   ├── schema.py                ← DuckDB star schema + all KPI views
│   ├── ASSUMPTIONS.md           ← All data decisions with PS-section rationale
│   └── DIMENSION_DICT.md        ← PS mandatory deliverable
├── kpis/
│   ├── KPI_FINAL.md             ← 19 Phase-1 KPIs with DuckDB formulas
│   └── KPI_CATALOG.md           ← All 35 KPIs including Phase 2+
├── config/
│   ├── metric_registry.yaml     ← 19 KPIs: type, view, page, persona
│   ├── dimensions.yaml          ← Dimension registry with cardinality
│   └── clients/CLIENT_1.yaml   ← Thresholds, enabled KPIs, alert channels
├── frontend/                    ← React (Vite) dashboard
│   └── src/
│       ├── pages/               ← 6 tabs
│       ├── components/          ← Charts, layout, NLQ panel
│       ├── store/useStore.js    ← Zustand global state
│       └── api/client.js        ← Axios API client
├── agents/
│   └── PLAN.md                  ← LangGraph architecture + MCP integration
├── api/                         ← FastAPI backend (Step 4)
└── Agent.md                     ← Agent system design, personas, extensibility
```

---

## Completion Status

| Step | Status | Notes |
|------|--------|-------|
| 1 — Data enrichment | ✅ Done | 4,569 rows, 32 TDD tests, seed=42 |
| 2 — KPI design | ✅ Done | 19 Phase-1 KPIs, YAML metric registry |
| 3 — DuckDB schema | ✅ Done | Star schema, 16 SQL views, 3 Python KPI tables |
| 4 — FastAPI backend | 🔧 In progress | Skeleton wired; endpoints need DuckDB connection |
| 5 — Agent layer | 🔲 Pending | LangGraph QnA + Text2SQL + MCP servers |
| 6 — Frontend | ✅ Done (mock data) | All 6 tabs, NLQ panel, charts — needs Step 4 wiring |
| 7 — Insights deck | 🔲 Pending | 8–12 slides, mandatory (10 marks) |
| 8 — Predictive layer | 🔲 Bonus | Chronos forecast, River anomaly detection |

---

## Dashboard Tabs

| Tab | Description | Key KPIs |
|-----|-------------|----------|
| Executive Summary | PCR headline, 3-stage funnel, AI Insights panel, workspace comparison | PCR, OPI, AGV, MCI |
| Usage & Trends | 90-day upload/publish charts, category breakdown, storage metrics | GR, AIL, TEU |
| Team Activity | Treemap, user table, D1×D2 CrossTab heatmap, LPI | TEU, OPI, LPI, DCDR |
| Publish Metrics | Workspace conversion bars, output mix, CPDG scatter | FSC, CPDG, SAC, AHY, EDR, HTHR, TSQI, PIG |
| Video Explorer | Searchable paginated table, ZSP badges, CSV export | ZSP, CPDG |
| Admin | AI KPI chatbot (Claude), KPI registry, access requests, client config | All 19 |

**Global controls:** COUNT ↔ HOURS toggle (TopNav) · Persona switcher · Agent Inbox bell · CLIENT_1 badge

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Data pipeline | Python + pandas + numpy (seed=42) |
| Storage | DuckDB (`frammer.duckdb`) |
| DB MCP | mcp-server-motherduck |
| Custom MCP | FastMCP (kpi_server, alert_server, report_server) |
| Backend | FastAPI |
| Agent framework | LangGraph + LangChain |
| MCP bridge | langchain-mcp-adapters |
| NLQ pipeline | SQL-of-Thought (arXiv:2509.00581) |
| LLM | Claude Sonnet (Anthropic API) |
| Frontend | React (Vite) + Tailwind CSS |
| Charts | Apache ECharts (echarts-for-react) |
| State | Zustand |
| Animation | Framer Motion |
| Icons | Lucide React |

---

## Setup

### Data + Schema
```bash
uv sync
uv run python data/enrich.py          # regenerate frammer_dataset.csv
uv run python data/schema.py          # build frammer.duckdb
uv run pytest data/test_enrich.py -v  # 32 tests, all should pass
```

### Frontend
```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # production build
```

### Backend (Step 4 — in progress)
```bash
uv run uvicorn api.main:app --reload --port 8000
# http://localhost:8000/api/health
```

---

## Workspace Publish Variance (core insight)

```
WS-DIGITAL-NEWS    ████████████████████ 92%  ← top performer
WS-ENTERTAINMENT   ████████████████     82%
WS-TECH-ANALYSIS   █████████████        68%
WS-LIFESTYLE       ██████████           52%
WS-SPORTS-LIVE     ███████              38%  ← investigation target (557 orphaned videos)
```

This variance is the central data story. Every tab is designed to explain and explore why it exists.
