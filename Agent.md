# Frammer AI — Analytics QnA Agent

> **Status:** Implemented and tested. 43/43 agent tests pass.
> Full architecture + build order → `agents/PLAN.md`

## 1. What We Built

An intelligent analytics dashboard for Frammer AI that goes beyond static charts. The core
differentiator is a **conversational QnA Agent** that lets non-technical stakeholders query
video operations data in plain English — while the underlying system handles SQL generation,
result narration, and proactive alerting automatically.

Implemented deliverables:
- Browser-based dashboard (6 tabs + NLQ floating panel)
- Conversational NLQ interface with SSE streaming — POST `/api/nlq` + GET `/api/nlq/stream`
- Ambient alert agent with Slack webhook dispatch
- PDF report download via WeasyPrint — `agents/mcp_servers/report_server.py`
- Star schema data model + metric/dimension dictionary
- SQL-of-Thought pipeline with deterministic guardrails (43/43 tests)
- Input/output/tool guardrails via `agents/middleware.py`

---

## 2. Architecture

### 2.1 Two-tier query routing (core design decision)

Not every query needs full SQL generation. Routing queries to the cheapest
capable layer reduces latency and eliminates failure surface during demo.

```
NL Query
    ↓
Intent Classifier (Router node)
    ↓                       ↓
Standard KPI            Ad-hoc / NLQ
(pre-computed)          (dynamic SQL)
    ↓                       ↓
Analytics Agent     Text2SQL Engine
    ↓                       ↓
          Chart Agent (shared renderer)
                ↓
    Chart/Table  |  Summary Insight  |  Sorry fallback
```

**Standard KPI** — queries that map to pre-aggregated metric snapshots:
- Upload / process / publish counts and hours (both — COUNT↔HOURS toggle)
- Publish funnel (uploaded → processed → published, 3-stage)
- Output type breakdowns (key_moments, chapters, summary, full_package, my_key_moments)
- Day-wise / week-wise trends
- Platform coverage index per channel

**Ad-hoc / NLQ** — queries requiring dynamic joins or multi-dim combinations:
- Any D1 × D2 breakdown not pre-computed (e.g. Channel × Input Type × Language)
- User-level drill-downs with custom filters
- Top-N queries ("which 5 users processed most but published least last week")
- Time comparisons with custom date ranges

**Classifier behavior:** Fails safe toward Text2SQL. If uncertain → escalate.
Never return a cached KPI answer for a query that might need fresh SQL.

---

### 2.2 Agent system

#### QnA Agent (LangGraph orchestrator)
- 4 nodes: **Router → Interpret → Execute → Narrate**
- State: `{session_id, persona, client_id, query, intent, filters, sql, result, chart_spec, narrative, history}`
- Persistent multi-turn memory via LangGraph checkpointer
- Always surfaces: filters applied, date range, dimensions used, tool calls made
- On failure: brief apology + one clarifying question. Never raw errors, never raw SQL.

#### Analytics Agent
- Owns pre-computed KPI layer (DuckDB views)
- Cronjob-driven refresh (configurable per deployment)
- Outputs: tabular KPI snapshots + optional trend text
- Boundary: if query needs a join beyond pre-aggregated tables → hand off to Text2SQL

#### Text2SQL Engine (SQL-of-Thought pattern)

Implements: Chaturvedi et al., "SQL-of-Thought: Multi-agentic Text-to-SQL
with Guided Error Correction" (arXiv:2509.00581)
Reference implementation: `draft/SQL-of-Thought-main/`

Internal pipeline (never exposed to user):

1. **Schema linking agent** — resolves NL entities to dim/fact table columns (via `describe_schema()` MCP tool)
2. **Query plan agent (CoT)** — step-by-step execution plan before any SQL is written
3. **SQL generation agent** — writes DuckDB-compatible SQL from the plan (temp=0)
4. **Guardrails layer** — two-tier: (a) deterministic regex blocks DDL/DML + PostgreSQL `::` cast
   syntax; (b) LLM validates aggregation, schema linking, filter type mismatches
5. **Correction loop** — scratchpad-aware retry (max 2). Categories from SQL-of-Thought taxonomy:
   wrong_cast_syntax, wrong_boolean_compare, agg_no_groupby, col_missing, etc.
6. **Post-processing + test verification** — executes against DuckDB via MCP tool, validates result shape
7. **Selective insight summarizer** — plain English summary, surfaced only when meaningful

#### Chart Agent (shared renderer)
- Receives structured JSON spec from either Analytics Agent or Text2SQL
- Renders via plotly.js (interactive, browser-native)
- Every chart supports COUNT ↔ HOURS global toggle
- Every chart supports D1 × D2 breakdown (grouped bar / stacked area / heatmap)
- Drill-down: click any bar → fires new NLQ with filter pre-filled

#### Ambient Agent (independent background loop)
Runs separately from the QnA path. Three always-running agents:

```
Monitor (cron: every 6h)  →  Intake (new row trigger)  →  Reporter (cron: 1st of month)
         ↓                           ↓                              ↓
   Alert Evaluator           Data Quality Check            generate_client_brief()
         ↓                           ↓                              ↓
   Agent Inbox (HITL)         Agent Inbox (HITL)           Agent Inbox (HITL)
```

HITL modes (Agent Inbox UI component):
- **Notify** — fire alert, no approval needed
- **Question** — ask user before sending external notification
- **Review** — surface insight for human decision

Dispatch: email (SMTP) + Slack (incoming webhook)

---

## 3. MCP Tool Layer

Tools are loaded via `langchain-mcp-adapters` and wired into LangGraph.

### 3.1 MotherDuck MCP (mcp-server-motherduck)
Exposes DuckDB directly — no custom wiring needed.
- `execute_query(sql)` — run any DuckDB SQL
- `list_tables()` — schema discovery
- `list_columns(table)` — column-level schema

### 3.2 Custom FastMCP Servers

**kpi_server** (`agents/mcp_servers/kpi_server.py`):
- `run_kpi_query(kpi_name, filters)` — execute pre-computed KPI
- `list_kpis(persona)` — list available KPIs for persona

**alert_server** (`agents/mcp_servers/alert_server.py`):
- `check_thresholds(client_id)` — evaluate all configured thresholds
- `fire_alert(alert)` — dispatch via email/Slack

**report_server** (`agents/mcp_servers/report_server.py`):
- `generate_client_brief(client_id, period)` → PDF bytes
- Internally calls run_aggregation + fetch_timeseries + fetch_details
- Output: Executive Summary, Channel Scorecard, Top 3 Recommendations, Data Quality, Next Steps

---

## 4. Data Model

### 4.1 Star schema

**Fact table:** `fact_video_events`

| Column | Type | Notes |
|---|---|---|
| video_id | TEXT PK | |
| uploaded_at | DATETIME | |
| processed_at | DATETIME | nullable |
| published_at | DATETIME | nullable |
| duration_seconds | INTEGER | source video duration |
| published_flag | BOOLEAN | |
| billable_flag | BOOLEAN | extensibility: billing analytics |
| client_id | TEXT FK | → dim_client (multi-tenant) |
| workspace_id | TEXT FK | → dim_workspace |
| user_id | INTEGER FK | → dim_user |
| team_id | INTEGER FK | → dim_team |
| language_id | INTEGER FK | → dim_language |
| input_type_id | INTEGER FK | → dim_input_type |
| output_type_id | INTEGER FK | → dim_output_type |
| platform_id | INTEGER FK | → dim_platform |
| impressions | INTEGER | post-publish: views |
| likes | INTEGER | |
| comments | INTEGER | |
| shares | INTEGER | |
| subscribers_gained | INTEGER | |
| ctr_percentage | FLOAT | |
| avg_view_percentage | FLOAT | watch completion % |
| total_watch_time_hours | FLOAT | |
| traffic_source | TEXT | |
| anomaly_score | FLOAT | River HalfSpaceTrees output |

**Dimension tables:** `dim_client`, `dim_workspace`, `dim_user`, `dim_team`,
`dim_language`, `dim_input_type`, `dim_output_type`, `dim_platform`

### 4.2 Pre-aggregated KPI tables (Analytics Agent layer)

- `agg_daily_summary` — upload/process/publish counts + hours by date × workspace × client
- `agg_output_type_summary` — counts + hours by output type × date
- `agg_channel_funnel` — processed vs published gap per workspace per period
- `agg_user_activity` — user-level contribution counts per period
- `predictions` — Chronos-Bolt-Tiny 3-month forecast outputs

---

## 5. Dashboard Structure (5 tabs)

### Tab 1: Executive Summary
- Dual headline: 69.8% overall PCR | workspace range 38–92% (side by side)
- 3-stage funnel overview (uploaded → processed → published)
- Platform Coverage Index per workspace
- Agent Inbox widget (pending HITL items)
- Alert banner if ambient agent fired in last 24h
- Global filters: date range, client, workspace, persona mode

### Tab 2: Usage & Trends
- Time-series: daily/weekly upload + publish counts AND hours
- COUNT ↔ HOURS global toggle (applies to all charts on page)
- Period comparison toggle (vs previous period / same period last year)
- Chronos-Bolt-Tiny forecast band (shaded, 3-month horizon)
- Anomaly score sparkline per workspace

### Tab 3: Team / Workspace / User Analysis
- D1 × D2 CrossTab panel — user selects any two dimensions
- Supported: Workspace × Input Type, Workspace × Language, User × Output Type, Team × Platform
- Drill-down: click any bar → filter rest of page to that value

### Tab 4: Publish Metrics + Funnel
- Output type distribution + publish rate per type
- Input type performance breakdown by frammer_output_type publish conversion
- My Key Moments highlight (64.6% PCR vs 70.9% summary — lowest converter, investigation hook)
- CPDG, SAC, AHY, EDR, HTHR, TSQI, PIG per content type

### Tab 5: Video Explorer
- Searchable, filterable detail table
- Columns: headline, workspace, team, input type, output type, duration,
  published flag, platform, uploaded by, uploaded at, ZSP score
- Export to CSV

### NLQ Interface (floating panel, available on all tabs)
- Text input: user types plain English query
- Thought process panel: shows Router → Interpret → Execute → Narrate with type badges
- Filter chips accumulate across multi-turn session
- Shows: applied filters, dimensions, date range, tool calls used
- Returns: chart or table inline + one-line insight
- On ambiguity or failure: apologetic message + one clarifying question

### Platform Connector Settings (modal)
- Shows registered MCP connectors: YouTube Analytics, Meta Business Suite, TikTok (coming soon)
- Add new connector by name + endpoint URL — demonstrates live extensibility

---

## 6. Personas

### Leadership (CEO / Manager)
- Default tab: Executive Summary
- KPIs: AGV, PMI, AIL, PCR, GR, Platform Coverage Index
- NLQ focus: trend analysis, cross-client comparison, PDF report generation
- Alert sensitivity: major anomalies only

### Creator (Editor / Uploader)
- Default tab: Video Explorer
- KPIs: TEU, OPI, ZSP, CPDG, HTHR
- NLQ focus: per-video analysis, backlog, individual publish conversion
- Alert sensitivity: low threshold (own content, backlog)

---

## 7. Extensibility Design

### YAML Metric Registry (no code change to add a KPI)
```yaml
# config/metric_registry.yaml
metrics:
  PCR:
    name: Publish Conversion Rate
    formula_file: kpis/sql/pcr.sql
    personas: [leadership, creator]
    dashboard_page: funnel
    phase: 1
```

### Multi-tenant Config
```yaml
# config/clients/CLIENT_1.yaml
client_id: CLIENT_1
thresholds:
  OPI_hours: 48
  AGV_drop_pct: 15
alert_channels:
  email: ops@client1.com
  slack_webhook: https://hooks.slack.com/...
```

Adding a new dimension: add column in `data/enrich.py` → add `dim_<name>` → register in `config/dimensions.yaml`.
No agent code change — schema linker discovers via `list_columns()` MCP tool.

---

## 8. Predictive Layer

| Signal | Model | Reason |
|--------|-------|--------|
| Upload count forecast (3-month) | Chronos-Bolt-Tiny (9M params) | Zero-shot, sparse data, smooth trend |
| Created count forecast | Chronos-Bolt-Tiny | Derived from upload signal |
| Publish rate forecast | Naive seasonal rule | 3 structural zeros, domain-specific |
| Anomaly detection (real-time) | River HalfSpaceTrees | Online learning, no training data |

Activated via config flag `enable_predictive: true` in metric_registry.yaml.

---

## 9. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Next.js + Tailwind | Fast, browser-native, easy to host |
| Charts | plotly.js | Interactive, no backend needed for rendering |
| Database | DuckDB (MotherDuck cloud or local file) | Analytical SQL, portable, no infra |
| DB MCP | mcp-server-motherduck | Native DuckDB-as-MCP, no custom wiring |
| Custom MCP | FastMCP | Minimal boilerplate, Python-native |
| LLM | Claude Sonnet (Anthropic API) | Best SQL accuracy per cost |
| Agent framework | LangGraph + LangChain | State machine, persistent memory, streaming |
| MCP bridge | langchain-mcp-adapters | Loads MCP tools into LangGraph natively |
| NLQ pipeline | SQL-of-Thought (arXiv:2509.00581) | Proven multi-step: link → plan → gen → guard |
| Forecasting | Chronos-Bolt-Tiny | Zero-shot, 9M params, runs on CPU |
| Anomaly detection | River HalfSpaceTrees | Online learning, per-event scoring |
| Alerts | APScheduler + SMTP + Slack webhook | Minimal infra, local cron |
| PDF export | WeasyPrint | Headless render, Python-native |
| Hosting | Vercel (frontend) + MotherDuck / local DuckDB | Zero-config for demo |

---

## 10. Assumptions

1. **Dataset is pre-enriched.** `data/frammer_dataset.csv` is the source of truth (4,569 rows, seed=42).
2. **DuckDB is the query engine.** All SQL is DuckDB-compatible. No PostgreSQL-specific syntax.
3. **plotly.js for all charts.** Direct JSON spec → render, no sandbox verification loop.
4. **Drag-and-drop layout is cut.** Static tab layout with sensible defaults.
5. **Chart verification loop is cut.** SQL-level correction loop catches root causes.
6. **Slack connector uses incoming webhook**, not OAuth.
7. **No user authentication layer.** Single-tenant for demo purposes.
8. **Ambient agent runs on APScheduler** (manual trigger button also available for demo).
9. **Text2SQL uses Claude Sonnet** across all agent roles.
10. **Chronos-Bolt-Tiny runs on CPU** (8GB RAM constraint, no GPU required).

---

## 11. Test Query Suite (validate before demo)

1. "How many videos were published last month?"
2. "Show me upload vs publish trend for last 30 days"
3. "Which workspace has the biggest processed vs published gap?"
4. "Show Workspace × Input Type breakdown for last quarter"
5. "Which users processed more than 10 hours but published less than 20%?"
6. "What is the publish rate for My Key Moments vs Chapters?"
7. "Show me Hindi content performance by workspace"
8. "Top 10 videos by duration and their publish status"
9. "Which output types are growing vs declining this month vs last?"
10. "Show me Workspace × Language for processed hours"
11. "Which team has the most unpublished backlog?"
12. "Compare this week vs last week for total upload hours"
13. "What is the platform coverage index for each workspace?"
14. "Generate monthly brief for CLIENT_1"
15. "What percentage of processed videos get published on average?"
