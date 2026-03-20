# GCAgent — MediaFlow AI Analytics Dashboard

## What We Are Building
Competition entry: IIT General Championship – Data Analytics 2026
Industry partner: MediaFlow AI
Problem: Design and build an improved product usage analytics dashboard for media operations.

Full problem statement: `draft/IIT_MediaFlow_ProblemStatement.pdf`

---

## Navigation Index

| Path | Contents |
|------|----------|
| `data/` | Final dataset, enrichment pipeline, assumptions doc |
| `kpis/` | KPI catalog (35 active), Phase-1 final list (19 KPIs) |
| `agents/` | Architecture plan, agent implementations, MCP servers |
| `config/` | YAML metric registry, client configs, dimension registry |
| `api/` | FastAPI backend |
| `frontend/` | Next.js + Tailwind dashboard |
| `draft/` | Reference only — original data, mockups, SQL-of-Thought impl |

| File | Purpose |
|------|---------|
| `data/dataset.csv` | Source of truth — final enriched dataset (4,569 rows, 29 cols) |
| `data/enrich.py` | Reproducible data enrichment pipeline (seed=42, 6 transforms) |
| `data/shift_dates.py` | Shifts upload_date/processed_date so max(upload_date)=today; run after enrich.py |
| `data/test_enrich.py` | TDD tests for enrichment pipeline (32 tests, all pass) |
| `data/ASSUMPTIONS.md` | All data decisions with PS-section rationale |
| `data/DIMENSION_DICT.md` | Dimension dictionary (PS mandatory deliverable) |
| `kpis/KPI_FINAL.md` | 19 Phase-1 KPIs with DuckDB formulas, dashboard page mapping |
| `kpis/KPI_CATALOG.md` | Complete catalog of all 35 KPIs including Phase 2+ |
| `config/metric_registry.yaml` | All 19 KPIs: type, view/table, page, persona, description |
| `config/dimensions.yaml` | Dimension registry with values, cardinality, API params |
| `config/clients/CLIENT_1.yaml` | CLIENT_1 thresholds, enabled KPIs, alert channels |
| `agents/PLAN.md` | Full architecture diagram + LangGraph state machine + build order |
| `Agent.md` | Agent system design, tool layer, personas, extensibility |
| `draft/IIT_MediaFlow_ProblemStatement.pdf` | Original PS |
| `draft/SQL-of-Thought-main/` | Reference implementation (arXiv:2509.00581) |

---

## Current Dataset Facts (authoritative — use these numbers everywhere)

> Source: `data/dataset.csv` after all 6 enrichment transforms, seed=42.
> Do NOT use the original MediaFlow data numbers (0.74%, 111 published) for our dashboard —
> those are from a different, aggregated dataset used only as a domain reference.

| Fact | Value |
|------|-------|
| Total rows | 4,569 |
| Rows with valid upload_date (= "uploaded") | 4,179 (91.5%) |
| Rows with processed_date (= "processed by MediaFlow AI") | 4,179 (100% of uploaded) |
| Rows with published_flag=True | 3,188 (69.8% overall) |
| PCR by workspace | WS-DIGITAL-NEWS 92% / WS-ENTERTAINMENT 82% / WS-TECH-ANALYSIS 68% / WS-LIFESTYLE 52% / WS-SPORTS-LIVE 38% |
| Companies | Company_A (4 workspaces), Company_B (1 workspace) |
| Workspaces | WS-DIGITAL-NEWS, WS-ENTERTAINMENT, WS-TECH-ANALYSIS, WS-LIFESTYLE, WS-SPORTS-LIVE |
| Teams | Digital_News, Entertainment, Tech_Analysis, Sports_Live, Lifestyle |
| Users | content_editor_01, content_editor_02, content_editor_03, content_editor_04 |
| Languages | English, Hindi |
| Input types | 7 (interview, speech, debate, news_bulletin, special_report, press_conference, discussion_show) |
| MediaFlow output types | 5 (key_moments, chapters, full_package, summary, my_key_moments) |
| Published formats | shorts (Youtube), reels (Instagram) |

### 3-Stage Funnel (our dataset)
```
Uploaded (upload_date not null): 4,179
        ↓ 100% processed by MediaFlow AI
Processed (processed_date not null): 4,179
        ↓ varies 38–92% by workspace
Published (published_flag=True): 3,188
        390 rows have no upload_date — data quality gap, visible in MCI/OPI KPIs
```

### Key Insight: Workspace Publish Variance (PS Section 6C)
| Workspace | Total | Published | PCR | Story |
|-----------|-------|-----------|-----|-------|
| WS-DIGITAL-NEWS | 1,200 | 1,106 | 92% | Top performer |
| WS-ENTERTAINMENT | 884 | 725 | 82% | Healthy |
| WS-TECH-ANALYSIS | 1,191 | 810 | 68% | Moderate bottleneck |
| WS-LIFESTYLE | 396 | 206 | 52% | Weak publisher |
| WS-SPORTS-LIVE | 898 | 341 | 38% | Low — investigation hook |

---

## Development Roadmap

### Step 1 — Data ✅
- [x] Enrich `Corrected_dataset.csv` → `data/dataset.csv`
- [x] Change 1: `input_type` realigned to PS vocabulary (7 B2B media types)
- [x] Change 2: `ai_output_type` column added (5 AI output types)
- [x] Change 3: `processed_date` column added (log-normal lag from upload_date)
- [x] Change 4: `workspace` column added (replaces misused `channel` column)
- [x] Change 5: `team_name` / `uploaded_by` / `company` relabelled to B2B media vocabulary
- [x] Change 6: Channel-level publish variance applied (38–92% PCR by workspace)
- [x] Change 7: `data/shift_dates.py` — shifts all timestamps so max(upload_date)=today (rolling window alignment); run after enrich.py
- [x] 32 TDD tests pass, seed=42, fully reproducible
- [x] All decisions documented in `data/ASSUMPTIONS.md` with PS-section rationale

### Step 2 — KPIs ✅
- [x] Audited all 42 draft KPIs
- [x] 35 active KPIs cataloged with formulas, dimensions, roles — `kpis/KPI_CATALOG.md`
- [x] 7 dropped KPIs documented with reasons
- [x] 19 Phase-1 KPIs with full DuckDB SQL/Python formulas — `kpis/KPI_FINAL.md`

### Step 3 — Data Model + DuckDB Schema ✅
> PS requirement: star schema, metric dictionary, dimension dictionary
- [x] `data/schema.py`: loads CSV, creates star schema, all KPI views, agg tables → `analytics.duckdb`
- [x] `fact_video_events` view (29 cols, TRY_CAST on all date fields)
- [x] 9 dimension tables (dim_workspace, dim_user, dim_team, dim_language, dim_input_type, dim_output_type, dim_ai_output_type, dim_platform, dim_date)
- [x] 16 SQL KPI views (v_pcr, v_fsc, v_gr, v_opi, v_teu, v_ail, v_sac, v_ahy, v_edr, v_hthr, v_tsqi, v_pig, v_agv, v_pmi, v_mci, v_dcdr)
- [x] 3 Python KPI tables (kpi_cpdg, kpi_zsp, kpi_lpi)
- [x] 4 pre-aggregated tables (agg_daily_summary, agg_channel_funnel, agg_output_type_summary, agg_user_activity)
- [x] `config/metric_registry.yaml` — 19 KPIs with metadata
- [x] `config/dimensions.yaml` — dimension registry
- [x] `config/clients/CLIENT_1.yaml` — client thresholds + alert config
- [x] `data/DIMENSION_DICT.md` — PS mandatory deliverable
- [x] KPI spot-check: PCR 38–92% variance across workspaces ✓

### Step 4 — Backend API ✅
> PS requirement: web-accessible dashboard, filterable endpoints
- [x] `api/main.py` — FastAPI app, CORS (localhost:5173), lifespan DB warm-up
- [x] `api/db.py` — read-only DuckDB singleton + `query_df()` / `query_one()` helpers
- [x] `api/config.py` — YAML loaders (metric_registry, dimensions, CLIENT_1)
- [x] `api/filters.py` — `FilterParams` (Depends) + `build_where_clause()` (zero interpolation)
- [x] `api/models.py` — Pydantic response shapes
- [x] `api/routers/health.py` — GET /api/health → {status, db_rows:4569, db_tables}
- [x] `api/routers/dimensions.py` — GET /api/dimensions
- [x] `api/routers/dashboard.py` — GET /api/dashboard/executive + /api/dashboard/publish-funnel
- [x] `api/routers/kpis.py` — GET /api/kpis/{acronym} + GET /api/kpis
- [x] `api/routers/trends.py` — GET /api/trends/daily + /api/trends/category
- [x] `api/routers/crosstab.py` — GET /api/crosstab (D1×D2 validated against dimensions.yaml allowlist)
- [x] `api/routers/videos.py` — GET /api/videos (paginated, filterable) + GET /api/videos/export (CSV)
- [x] `api/routers/admin.py` — KPI CRUD + KPI chatbot (Gemini via Vertex AI) + config read/write
- [x] `api/routers/nlq.py` — POST /api/nlq (delegates to agents.qna_agent)
- [x] `api/test_api.py` — 32 TDD tests, all pass

### Step 5 — Agent Layer ✅
> PS requirement: prompt-based querying, vector search / semantic retrieval, show filters/dims applied
- [x] `agents/graph_state.py` — TypedDict AgentState (session_id, persona, thought_steps, history, …)
- [x] `agents/vector_store.py` — BigQuery Vector Search (`analytics-prod-123.analytics_vectors`), tables `kpi_embeddings` + `dimension_embeddings`, Vertex AI `text-embedding-005`
- [x] `agents/text2sql/schema_linker.py` — NL entities → DuckDB columns (Gemini 2.0 Flash, temp=0)
- [x] `agents/text2sql/query_planner.py` — CoT step-by-step plan before SQL gen
- [x] `agents/text2sql/sql_generator.py` — DuckDB SQL from plan + _postprocess_sql()
- [x] `agents/text2sql/guardrails.py` — blocks DDL/DML, ::TIMESTAMP cast, boolean=1; SQL-of-Thought error taxonomy
- [x] `agents/text2sql/correction_loop.py` — scratchpad-aware retry (max 2), correction_plan + correction_sql agents
- [x] `agents/mcp_servers/kpi_server.py` — FastMCP: run_kpi_query, list_kpis
- [x] `agents/mcp_servers/alert_server.py` — FastMCP: check_thresholds, fire_alert
- [x] `agents/mcp_servers/report_server.py` — FastMCP: generate_client_brief (WeasyPrint PDF / base64)
- [x] `agents/qna_agent.py` — LangGraph 4-node graph (Router→Analytics|Text2SQL→Narrate), MemorySaver checkpointer, persona routing
- [x] `agents/test_agents.py` — 43 TDD tests pass (Slices 1–14, including WS-8 guardrails)
- [x] `agents/middleware.py` — MediaFlowInputGuardrail, MediaFlowOutputGuardrail, MediaFlowToolGuardrail
- [x] `agents/qna_agent.py` — input/output guardrail nodes in graph; _execute_sql() 30s timeout + 5k row cap
- [x] `agents/text2sql/guardrails.py` — 50k char SQL length cap + sql_too_long taxonomy code
- [x] `api/models.py` — NLQRequest/HITLResumeRequest field validators (Literal, max_length, pattern)
- [x] `api/routers/nlq.py` — /nlq/stream query params validated (Literal persona, pattern session_id)

### Step 6 — Dashboard (Frontend) ✅
> PS requirement: 5 pages, browser-based, COUNT↔HOURS toggle, multi-dim drill-downs
> Stack: React (Vite) + Tailwind CSS + Apache ECharts + Zustand + Framer Motion
- [x] Tab 1: Executive Summary — PCR headline, 3-stage funnel, AI Insights panel, workspace PCR bars; workspace summary table from live API
- [x] Tab 2: Usage & Trends — 3 sub-tabs (Time/Category/Storage); output type chart/table from `/trends/output-type`; workspace hours from executive API; weekly hours aggregated from daily
- [x] Tab 3: Team Activity — Treemap, user activity table from `/dashboard/users`, D1×D2 CrossTab heatmap, LPI card; KPI cards from API
- [x] Tab 4: Publish Metrics — workspace conversion bars, output mix donut, CPDG scatter; HTHR table from `/kpis/HTHR`; overall PCR and top output KPI cards dynamic
- [x] Tab 5: Video Explorer — searchable paginated table, ZSP badges, filters, CSV export; fully API-driven
- [x] Tab 6: Admin — AI KPI chatbot, KPI registry list, access requests, client config
- [x] NLQ floating panel — two-stage (compact floating card → expanded modal with chart area); SSE streaming
- [x] Collapsible sidebar — flex item (no gap), hover-expand on logo, full-height active indicator
- [x] Agent Inbox widget in TopNav bell dropdown (HITL: Notify/Question/Review)
- [x] RBAC: role differences apply to KPI/chart visuals only; nav order same for all roles
- [x] Backend wiring: all 5 data pages wired to live API; mock data retained as offline fallback only
- [x] New endpoints: `GET /trends/output-type`, `GET /dashboard/users`, `total_hours` added to workspace_pcr
- [x] Chronos forecast band — shaded confidence band + median dashed line in TrendChart (Usage & Trends tab)
- [x] Persona toggle replaced with read-only role badge in TopNav
- [x] Favicon fix (F→M), suite cards content fix, null guards across pages
- [x] Axios `paramsSerializer` fix for FastAPI repeated-param array filters
- [x] `activeTab` synced on route changes via `Layout.jsx` useEffect — fixes NLQ context banner and quick prompts
- [x] NLQ error display: shows actual agent error instead of stale placeholder; guardrail blocks flow via `final` SSE event
- [x] Dashboard charts draggable into NLQ panel (`DraggableChart` wrapper + ChartDropZone JSON accept)
- [x] Null guard on `inputTypeMix` mapping in PublishMetrics (uses `humanize()`)
- [ ] Platform Connector Settings modal (extensibility demo)

### Step 7 — Insights Deck 🔲 *(mandatory, 10 marks — team deliverable)*
> PS requirement Section 7.3: PDF/PPT 8–12 slides
- [ ] Dashboard walkthrough (5 tabs)
- [ ] Top insights — use actual numbers from `data/dataset.csv`, NOT original MediaFlow data
- [ ] Improvement recommendations
- [ ] "Next layer" roadmap

### Step 8 — Predictive Layer ✅ *(bonus — implemented)*
- [ ] Ambient Monitor/Intake/Reporter agents
- [ ] River HalfSpaceTrees anomaly detection
- [x] Chronos-Bolt-Tiny 30-day upload forecast — `GET /api/trends/forecast`, confidence band in TrendChart (ECharts stacked series), 7 TDD tests

---

## Scoring Strategy

| Criteria | Weight | Our Answer |
|----------|--------|------------|
| Business understanding & KPI design | 20 | 19 Phase-1 KPIs across 5 PS sections; funnel PCR/FSC/OPI; YAML metric registry |
| Dashboard UX & navigability | 20 | 5 tabs; COUNT↔HOURS toggle; D1×D2 CrossTab; persona modes; filter chips |
| Analytical depth + NL query | 20 | 4-node LangGraph; SQL-of-Thought; vector search; multi-turn memory; thought process panel |
| Data quality checks | 15 | MCI, DCDR, OPI; 390 null upload_date rows; workspace publish variance as data story |
| Scalability / extensibility | 15 | YAML metric registry; config-driven clients; live connector modal |
| Presentation & communication | 10 | Workspace PCR variance story; underperforming channel insight; funnel drop-off narrative |

---

## Architecture

```
data/dataset.csv (4,569 rows, 29 cols, seed=42)
        ↓
data/schema.py          ← star schema + KPI views
        ↓
analytics.duckdb  (9 dim tables + fact view + 16 KPI views + 3 Python KPI tables + 4 agg tables)
        ↓
mcp-server-motherduck   ← execute_query, list_tables, list_columns
FastMCP servers         ← kpi_server, alert_server, report_server
        ↓
langchain-mcp-adapters  ← loads all MCP tools into LangGraph
        ↓
LangGraph QnA Agent     ← Router → Interpret → Execute → Narrate
   ├── Analytics Agent  ← pre-aggregated KPI layer (fast path)
   └── Text2SQL Engine  ← SQL-of-Thought (schema link → plan → gen → guard → correct)
        ↓
api/llm.py              ← Central Vertex AI client (Gemini 2.0 Flash, text-embedding-004)
   ├── complete()       ← single-turn LLM call
   ├── chat()           ← multi-turn LLM call
   └── get_llm()        ← cached ChatVertexAI instance
        ↓
FastAPI backend (/api/*)
        ↓
React (Vite) + Tailwind frontend (6 tabs + NLQ panel + Agent Inbox)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Data pipeline | Python, pandas, numpy (seed=42) |
| Storage | DuckDB (`analytics.duckdb`) |
| DB MCP | mcp-server-motherduck |
| Custom MCP | FastMCP (kpi_server, alert_server, report_server) |
| Backend | FastAPI (Python) |
| Agent framework | LangGraph + LangChain |
| MCP bridge | langchain-mcp-adapters |
| NLQ pipeline | SQL-of-Thought pattern (arXiv:2509.00581) |
| LLM | Gemini 2.0 Flash — Vertex AI via `langchain-google-vertexai` |
| Embeddings | Vertex AI `text-embedding-005` — `langchain-google-vertexai` |
| Vector store | BigQuery Vector Search — `langchain-google-community[bigquery]` |
| BQ dataset | `analytics-prod-123.analytics_vectors` (tables: kpi_embeddings, dimension_embeddings) |
| GCP auth | Service account JSON (`GOOGLE_APPLICATION_CREDENTIALS`) |
| GCP project | analytics-prod-123, region us-central1 |
| Forecasting | Chronos-Bolt-Tiny (9M params, zero-shot, Apache 2.0) |
| Anomaly detection | River HalfSpaceTrees (online learning) |
| Frontend | React (Vite) + Tailwind CSS |
| Charts | Apache ECharts (echarts-for-react) |
| PDF export | WeasyPrint |
| Alerts | APScheduler + Slack webhook (email: Phase 2 via Cloud Pub/Sub → SendGrid) |

---

## Key Domain Facts

**MediaFlow pipeline (3-stage):** Upload → Process (AI) → Publish
(PS Section 3B, 6C — this funnel is the core of the dashboard)

**Input types (PS Section 9 vocabulary):**
interview, news_bulletin, special_report, speech, debate, press_conference, discussion_show

**MediaFlow output types (PS Section 3C):**
key_moments, chapters, summary, full_package, my_key_moments

**Published formats (platform layer):**
shorts → Youtube | reels → Instagram

**Workspace → Team mapping:**
WS-DIGITAL-NEWS (Digital_News, Company_B) | WS-ENTERTAINMENT (Entertainment, Company_A) |
WS-TECH-ANALYSIS (Tech_Analysis, Company_A) | WS-LIFESTYLE (Lifestyle, Company_A) |
WS-SPORTS-LIVE (Sports_Live, Company_A)

**Platform Coverage Index:** total_platform_publishes / unique_published_videos

**Multi-tenant:** CLIENT_1 is one tenant; YAML configs support CLIENT_2, CLIENT_3 without code change

**Personas (PS Section 2):**
- Leadership (CEO/Manager/Client Success) → default tab: Executive Summary
- Creator (Editor/Uploader/Production) → same nav order; RBAC affects KPI/chart visuals only (not page ordering)

---

## Decisions & Rationale Log

| Decision | Rationale | PS Reference |
|----------|-----------|--------------|
| Synthetic dataset over original aggregated data | Original has only 111 rows, no per-video metrics | PS Section 9 — teams may augment |
| input_type vocabulary replaced | Original used consumer creator terms; PS explicitly uses journalism terms | PS Section 9 |
| ai_output_type added | Distinguishes what MediaFlow AI creates from what gets published | PS Section 3C, 6B |
| processed_date added | Enables 3-stage funnel — core PS requirement | PS Section 3B, 6C |
| workspace added | "Channel" in original was misused (contained publish platform) | PS Section 3A |
| Team/user names relabelled to B2B vocabulary | Original names (Reacts, user1_reacts) read as YouTube creator — B2B dashboard demo needs professional labels | PS Section 2 ("media teams") |
| Channel-level PCR variance (38–92%) | Uniform 91.5% rate tells no story; PS explicitly asks for high-volume/low-publish pattern analysis | PS Section 4, 6C |
| DuckDB over PostgreSQL | Competition-appropriate, zero-infra, MotherDuck MCP available | PS Section 7.4 |
| Star schema | PS explicitly recommends it | PS Section 7.2 |
| YAML metric registry | New KPIs/dimensions added without code change — scalability criterion | PS Section 8C |

---

## Coding Standards

- No AI tool names in git commit author
- All LLM/embedding calls go through `api/llm.py` — never call Vertex AI SDK directly from routers/agents
- `GOOGLE_APPLICATION_CREDENTIALS` → `service-account-key.json` (gitignored via `*.json` rule)
- Every assumption → document in `data/ASSUMPTIONS.md` with PS-section reference
- Every KPI formula → `kpis/KPI_FINAL.md` and `kpis/KPI_CATALOG.md`
- SQL must be DuckDB-compatible — use `TRY_CAST(... AS TIMESTAMP)` not `::TIMESTAMP`
- Python: seed=42 everywhere randomness is used
- Commit at each meaningful step
