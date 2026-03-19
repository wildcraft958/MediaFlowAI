# Frammer AI — Agent Architecture Plan

> Last updated: 2026-03-19
> Reference implementations:
> - SQL-of-Thought pattern: `draft/SQL-of-Thought-main/` (arXiv:2509.00581)
> - MotherDuck MCP: `mcp-server-motherduck` (npm)
> - Agent orchestration: LangGraph + LangChain + `langchain-mcp-adapters`

---

## 1. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER LAYER                                         │
│                                                                               │
│   Leadership Persona              Creator Persona                             │
│   (CEO / Manager)                 (Editor / Uploader)                         │
│   • Funnel health, AGV, PMI       • Per-video ZSP, CPDG, TEU                 │
│   • MoM/WoW trends, alerts        • Backlog OPI, publish conversion           │
│   • PDF narrative report          • My team's activity                        │
│                                                                               │
│         ┌──────────────────┐          ┌──────────────────────┐               │
│         │  Dashboard UI    │          │  NLQ Floating Panel  │               │
│         │  5 tabs          │          │  + Agent Inbox       │               │
│         │  COUNT↔HOURS     │          │  (HITL interface)    │               │
│         │  D1×D2 CrossTab  │          │                      │               │
│         └────────┬─────────┘          └──────────┬───────────┘               │
└──────────────────┼───────────────────────────────┼─────────────────────────-─┘
                   │                               │
                   ▼                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        QnA AGENT  (LangGraph Orchestrator)                    │
│                                                                               │
│   ┌──────────┐    ┌─────────────┐    ┌──────────────┐    ┌──────────────┐   │
│   │  ROUTER  │───▶│  INTERPRET  │───▶│   EXECUTE    │───▶│   NARRATE    │   │
│   │          │    │             │    │              │    │              │   │
│   │ Intent   │    │ Schema link │    │ Run query or │    │ Plain-English │   │
│   │ classify │    │ Entity res. │    │ KPI lookup   │    │ summary +    │   │
│   │ CoT      │    │ CoT plan    │    │ Chart spec   │    │ chart spec   │   │
│   │          │    │             │    │              │    │ JSON output  │   │
│   └──────────┘    └─────────────┘    └──────────────┘    └──────────────┘   │
│        │                                    │                                 │
│        ├── Standard KPI ──────────────────▶ Analytics Agent (pre-computed)   │
│        └── Ad-hoc / NLQ ─────────────────▶ Text2SQL Engine (dynamic)         │
│                                                                               │
│   State: {session_id, persona, filters, history, last_chart_spec}            │
│   Memory: persistent multi-turn state (LangGraph checkpointer)               │
└──────────────────────┬───────────────────────────────────────────────────────┘
                       │
          ┌────────────┴─────────────┐
          ▼                          ▼
┌──────────────────┐       ┌────────────────────────────────────────────────┐
│  ANALYTICS AGENT │       │  TEXT2SQL ENGINE  (SQL-of-Thought pattern)     │
│                  │       │                                                 │
│  Pre-aggregated  │       │  1. Schema Linking Agent                       │
│  KPI snapshots   │       │     └─ NL entities → dim/fact columns          │
│                  │       │  2. Query Plan Agent (CoT, temp=0.7)           │
│  DuckDB views:   │       │     └─ Step-by-step before SQL is written      │
│  agg_daily       │       │  3. SQL Generation Agent (temp=0)              │
│  agg_funnel      │       │     └─ DuckDB-compatible SQL                   │
│  agg_user        │       │  4. Guardrails Layer                           │
│  agg_output_type │       │     └─ Hallucinated cols, bad joins,           │
│                  │       │        impossible filters, agg misuse          │
│  Refreshed by    │       │  5. Correction Loop (max 2 retries)            │
│  cronjob         │       │     └─ Taxonomy: schema/join/filter/agg        │
└────────┬─────────┘       │  6. Post-process + verify (execute on DB)      │
         │                 │  7. Selective Insight Summarizer               │
         └────────┬────────└────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│              MCP TOOL LAYER  (langchain-mcp-adapters)                         │
│                                                                               │
│  ┌──────────────────────┐   ┌───────────────────────┐                        │
│  │  MotherDuck MCP      │   │  Custom MCP Servers   │                        │
│  │  (mcp-server-        │   │  (built with FastMCP)  │                        │
│  │   motherduck)        │   │                        │                        │
│  │                      │   │  • kpi_server          │                        │
│  │  Tools:              │   │    run_kpi_query()     │                        │
│  │  run_sql_query()     │   │    list_kpis()         │                        │
│  │  list_tables()       │   │    get_kpi_formula()   │                        │
│  │  describe_schema()   │   │                        │                        │
│  │  create_view()       │   │  • alert_server        │                        │
│  └──────────────────────┘   │    check_thresholds()  │                        │
│                              │    fire_alert()        │                        │
│                              │                        │                        │
│                              │  • report_server       │                        │
│                              │    generate_client_    │                        │
│                              │    brief() → PDF       │                        │
│                              └───────────────────────┘                        │
└──────────────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                             │
│                                                                               │
│  DuckDB (MotherDuck cloud or local file)                                      │
│                                                                               │
│  Fact table:     fact_video_events                                            │
│  Dimensions:     dim_workspace, dim_user, dim_team, dim_date,                │
│                  dim_content_type, dim_language, dim_platform                 │
│  KPI views:      v_pcr, v_fsc, v_gr, v_opi, v_teu, v_ail, ...               │
│  Agg tables:     agg_daily_summary, agg_channel_funnel,                      │
│                  agg_output_type_summary, agg_user_activity                  │
│                                                                               │
│  Source: data/frammer_dataset.csv (4,569 rows, 29 cols, seed=42)             │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│           AMBIENT AGENT  (independent background loop)                        │
│                                                                               │
│  Cronjob ──▶ Alert Evaluator ──▶ HITL Decision ──▶ Notification Dispatch     │
│                                                                               │
│  Signals monitored:                                                           │
│  • Unpublished backlog > N hours (OPI threshold)                             │
│  • Subscriber gain/drop > X% (AGV anomaly)                                   │
│  • Likes/impressions Z-score > 2.5 (River HalfSpaceTrees)                   │
│  • Any KPI threshold breach (configurable per client in YAML)                │
│                                                                               │
│  HITL modes (Agent Inbox UI):                                                 │
│  • Notify  — fire alert, no approval needed                                  │
│  • Question — ask user before sending external notification                  │
│  • Review  — surface insight for human decision                              │
│                                                                               │
│  Dispatch: email (SMTP) + Slack (incoming webhook)                           │
│  Output format: metric_name | current_value | threshold |                    │
│                 affected_workspace | suggested_action                        │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│           PREDICTIVE LAYER  (Phase 2 / extensibility hook)                   │
│                                                                               │
│  • Chronos-Bolt-Tiny: zero-shot time series forecasting                      │
│    → AGV next-month projection, PMI 4-week forecast                          │
│  • River (HalfSpaceTrees): online anomaly detection                          │
│    → Real-time Z-score for likes/impressions                                 │
│  Activated by: config flag `enable_predictive: true` in metric_registry.yaml │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. LangGraph State Machine

```python
# State schema
class AgentState(TypedDict):
    session_id: str
    persona: Literal["leadership", "creator"]
    client_id: str                  # multi-tenant
    query: str
    intent: str                     # "standard_kpi" | "adhoc_nlq" | "alert_query"
    filters: dict                   # {workspace, date_range, team, language, ...}
    sql: str
    result: list[dict]
    chart_spec: dict
    narrative: str
    error: str | None
    history: list[dict]             # multi-turn session memory

# Graph nodes
graph.add_node("router",    router_node)      # intent classify, CoT
graph.add_node("interpret", interpret_node)   # schema link, query plan
graph.add_node("execute",   execute_node)     # run KPI or Text2SQL
graph.add_node("narrate",   narrate_node)     # plain-English summary + chart spec

# Routing edges
graph.add_conditional_edges(
    "router",
    route_by_intent,
    {
        "standard_kpi": "execute",    # skip interpret for pre-computed KPIs
        "adhoc_nlq":    "interpret",  # full Text2SQL pipeline
        "alert_query":  "execute",    # direct threshold check
    }
)
graph.add_edge("interpret", "execute")
graph.add_edge("execute",   "narrate")
graph.set_entry_point("router")
```

---

## 3. MCP Tool Integration

### 3.1 MotherDuck MCP (run_sql_query)

```python
# langchain-mcp-adapters wraps MCP tools as LangChain tools
from langchain_mcp_adapters import MCPToolkit

motherduck = MCPToolkit(server="mcp-server-motherduck")
tools = motherduck.get_tools()
# Exposes: run_sql_query, list_tables, describe_schema, create_view
```

### 3.2 Custom KPI MCP Server (FastMCP)

```python
from fastmcp import FastMCP

kpi_mcp = FastMCP("kpi_server")

@kpi_mcp.tool()
def run_kpi_query(kpi_name: str, filters: dict) -> dict:
    """Execute pre-computed KPI from metric registry."""
    ...

@kpi_mcp.tool()
def list_kpis(persona: str = "all") -> list[str]:
    """List available KPIs, optionally filtered by persona."""
    ...

@kpi_mcp.tool()
def generate_client_brief(client_id: str, period: str) -> bytes:
    """Generate PDF narrative report for a client period."""
    ...
```

---

## 4. Personas

### 4.1 Leadership (CEO / Manager)
- Default tab: Executive Summary
- KPIs surfaced: AGV, PMI, AIL, PCR, GR, SAC
- NLQ examples:
  - "How are we trending vs last quarter?"
  - "Which workspace has the worst publish conversion?"
  - "Show me subscriber growth across all clients"
- Alert sensitivity: high threshold (major anomalies only)
- PDF report: monthly narrative with embedded charts

### 4.2 Creator (Editor / Uploader)
- Default tab: Team Activity / Video Explorer
- KPIs surfaced: TEU, OPI, ZSP, CPDG, HTHR, DCDR
- NLQ examples:
  - "Which of my videos has the biggest promise gap?"
  - "Show me my upload pattern this week"
  - "Which content type gets me the most watch time per hour?"
- Alert sensitivity: low threshold (backlog, individual video anomalies)
- No PDF report (not their workflow)

### 4.3 Persona routing in LangGraph

```python
def router_node(state: AgentState) -> AgentState:
    persona_context = PERSONA_PROMPTS[state["persona"]]
    # Inject persona into system prompt before intent classification
    ...
```

---

## 5. Extensibility Design

### 5.1 Metric Registry (YAML — no code change to add a KPI)

```yaml
# config/metric_registry.yaml
metrics:
  PCR:
    name: Publish Conversion Rate
    formula_file: kpis/sql/pcr.sql
    personas: [leadership, creator]
    dashboard_page: funnel
    ps_section: 6C
    phase: 1

  NEW_KPI:
    name: Some New Metric
    formula_file: kpis/sql/new_kpi.sql
    personas: [leadership]
    dashboard_page: executive_summary
    ps_section: 6A
    phase: 2
    enable_predictive: true
```

### 5.2 Multi-tenant config

```yaml
# config/clients/CLIENT_1.yaml
client_id: CLIENT_1
display_name: Frammer Workspace A
thresholds:
  OPI_hours: 48
  AGV_drop_pct: 15
  ZScore_anomaly: 2.5
alert_channels:
  email: ops@client1.com
  slack_webhook: https://hooks.slack.com/...
enabled_kpis: [PCR, FSC, GR, OPI, TEU, AIL, AGV, PMI]
```

### 5.3 Adding a new dimension
1. Add column to `data/enrich.py`
2. Add `dim_<name>` table in star schema migration
3. Register in `config/dimensions.yaml`
4. No agent code changes — schema linker discovers via `describe_schema()` MCP tool

---

## 6. Chart Agent

All charts rendered via plotly.js from a structured JSON spec.

```json
{
  "chart_type": "bar",
  "x": "frammer_workspace",
  "y": "pcr_pct",
  "color": "input_type",
  "toggle": "count_or_hours",
  "title": "Publish Conversion Rate by Workspace",
  "filters_applied": {"date_range": "2024-01", "language": "en"},
  "source_kpi": "PCR"
}
```

- COUNT ↔ HOURS toggle: applied globally per dashboard page
- D1 × D2 CrossTab: `color` field + `facet` for three-way breakdown
- Drill-down: click any bar → fires new NLQ with filter pre-filled

---

## 7. Ambient Agent Cron Flow

```python
# agents/ambient_agent.py
def run_ambient_check(client_id: str):
    config = load_client_config(client_id)
    kpi_values = fetch_current_kpis(client_id)

    alerts = []
    for metric, threshold in config["thresholds"].items():
        if kpi_values[metric] > threshold:
            alerts.append(build_alert(metric, kpi_values[metric], threshold))

    # Anomaly detection via River
    for video in get_recent_videos(client_id):
        if anomaly_detector.score_one(video) > ANOMALY_THRESHOLD:
            alerts.append(build_anomaly_alert(video))

    for alert in alerts:
        if alert.hitl_mode == "notify":
            dispatch_immediately(alert, config)
        elif alert.hitl_mode == "question":
            push_to_agent_inbox(alert)  # HITL — waits for user approval
        elif alert.hitl_mode == "review":
            push_to_agent_inbox(alert)  # HITL — surface for human decision
```

---

## 8. Text2SQL Engine Detail

Implements SQL-of-Thought (arXiv:2509.00581), adapted for DuckDB + Frammer schema.

```
User NL query
      │
      ▼
[1] Schema Linking Agent
    Input:  NL query + schema description (from describe_schema() MCP tool)
    Output: {entities: ["channel", "input_type"], columns: ["frammer_workspace", "input_type"], filters: [...]}
    Temp:   0.3

[2] Query Plan Agent (CoT)
    Input:  linked schema + NL query
    Output: step-by-step plan (JOIN strategy, aggregation, GROUP BY)
    Temp:   0.7  ← reasoning-critical

[3] SQL Generation Agent
    Input:  query plan + schema
    Output: DuckDB-compatible SQL
    Temp:   0.0  ← deterministic

[4] Guardrails Layer  (rule-based, no LLM)
    Checks:
    - No hallucinated column names (compare to describe_schema output)
    - No cross-client data leakage (WHERE client_id = {client_id} present)
    - No UPDATE/DELETE/DROP
    - Aggregation sanity (no bare column in SELECT with GROUP BY)
    On trip → inject error type into correction prompt

[5] Correction Loop  (max 2 retries)
    Error taxonomy: schema_mismatch | join_error | filter_type | agg_error
    Each type has a guided correction prompt template

[6] Execution + Validation
    Run via run_sql_query() MCP tool
    Validate: row count > 0, column names match expected

[7] Selective Insight Summarizer
    Activated only if result has meaningful trend or outlier
    Output: one plain-English sentence surfaced to user
```

---

## 9. PDF Report Tool

```python
@report_mcp.tool()
def generate_client_brief(client_id: str, period: str) -> bytes:
    """
    Generates a narrative PDF report.
    - Calls Claude to write a 3-paragraph narrative from KPI snapshot
    - Embeds 3 key charts as images (exported from plotly)
    - Renders via WeasyPrint
    Returns: PDF bytes
    """
```

Output structure:
1. Period overview (total uploads, publish rate, top-performing content)
2. Key movements (biggest changes vs previous period)
3. Attention items (alerts that fired, recommended actions)

---

## 10. Build Order

```
Phase 1 — Foundation
  Step 3:  DuckDB star schema + KPI views (data/schema.py)
  Step 4:  FastAPI backend + MCP tool wiring (api/)
  Step 5a: Analytics Agent + Text2SQL pipeline (agents/)
  Step 5b: QnA Agent orchestration via LangGraph (agents/)

Phase 2 — Dashboard
  Step 6:  Frontend 5 tabs (frontend/)
           - Tab 1: Executive Summary (Leadership default)
           - Tab 2: Usage & Trends
           - Tab 3: Team / Workspace / User Analysis
           - Tab 4: Publish Metrics + Funnel
           - Tab 5: Video Explorer (Creator default)
           - NLQ panel + Agent Inbox (HITL)

Phase 3 — Intelligence
  Step 7:  Ambient Agent + alert dispatch (agents/ambient_agent.py)
  Step 8:  PDF report tool (agents/report_server.py)
  Step 9:  Predictive layer hooks (Chronos-Bolt-Tiny, River) — config-gated
```

---

## 11. File Structure (target)

```
GCAgent/
├── data/
│   ├── frammer_dataset.csv     ← source of truth
│   ├── enrich.py               ← enrichment pipeline
│   ├── schema.py               ← DuckDB star schema + KPI view creation
│   └── ASSUMPTIONS.md
│
├── config/
│   ├── metric_registry.yaml    ← all KPIs + metadata
│   ├── dimensions.yaml         ← dimension registry
│   └── clients/
│       ├── CLIENT_1.yaml
│       ├── CLIENT_2.yaml
│       └── CLIENT_3.yaml
│
├── agents/
│   ├── PLAN.md                 ← this file
│   ├── qna_agent.py            ← LangGraph orchestrator
│   ├── analytics_agent.py      ← pre-computed KPI layer
│   ├── text2sql/
│   │   ├── schema_linker.py
│   │   ├── query_planner.py
│   │   ├── sql_generator.py
│   │   ├── guardrails.py
│   │   └── correction_loop.py
│   ├── ambient_agent.py        ← background alert evaluator
│   └── mcp_servers/
│       ├── kpi_server.py       ← FastMCP: run_kpi_query, list_kpis
│       ├── alert_server.py     ← FastMCP: check_thresholds, fire_alert
│       └── report_server.py    ← FastMCP: generate_client_brief
│
├── api/
│   └── main.py                 ← FastAPI app
│
├── frontend/                   ← Next.js + Tailwind
│
├── kpis/
│   ├── KPI_FINAL.md
│   ├── KPI_CATALOG.md
│   └── sql/                    ← one .sql file per KPI
│
├── Agent.md                    ← high-level architecture doc
├── CLAUDE.md                   ← navigation index + roadmap
└── SKILL.md
```

---

## 12. Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Agent framework | LangGraph + LangChain | State machine maps cleanly to router→interpret→execute→narrate; first-class streaming |
| DB + MCP | MotherDuck MCP (`mcp-server-motherduck`) | Cloud DuckDB + MCP = agents get SQL tool without custom wiring |
| Custom MCP servers | FastMCP | Minimal boilerplate, Python-native, exposes KPI/alert/report as standard MCP tools |
| SQL pattern | SQL-of-Thought (arXiv:2509.00581) | Proven multi-step: schema link → plan → gen → guardrails → correction |
| Multi-tenant | YAML client configs | No schema changes to add a client; agent reads config at session start |
| Extensibility | YAML metric registry | Add KPI by adding a YAML entry + SQL file; zero agent code change |
| Personas | Route at session start | Persona sets default tab, default KPIs, alert sensitivity — one system, two UX modes |
| Anomaly detection | River HalfSpaceTrees | Online learning, no training data required, fits streaming video events |
| Forecasting | Chronos-Bolt-Tiny | Zero-shot, no fine-tuning, runs locally — suitable for competition scope |
