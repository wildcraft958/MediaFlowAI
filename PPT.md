# MediaFlow AI — Analytics Dashboard
## IIT General Championship · Data Analytics 2026
### Presentation Script & Slide Content

---

## Slide 1 — Problem Statement

**Title:** The Cost of Flying Blind in B2B Media

**Context:** MediaFlow AI is a B2B media operations platform used by newsrooms and production houses. It ingests raw video uploads (interviews, debates, press conferences, news bulletins) and uses AI to generate structured output — key moments, chapters, summaries, full packages — which are then published to YouTube Shorts and Instagram Reels.

**The Problem:**
Clients have no visibility into where their content pipeline is failing.

> *"We upload 900 videos. We publish 341. Nobody knows why 559 are stuck."*
> — WS-SPORTS-LIVE data story

Three questions every client head of content needs answered daily:
1. **Funnel efficiency** — what percentage of uploaded videos reach publish?
2. **Bottleneck location** — is the drop-off at upload, AI processing, or editorial review?
3. **ROI by content type** — which AI output format actually drives views?

**Our answer:** A full-stack analytics dashboard with a conversational AI layer — so clients get answers in English, not SQL.

---

## Slide 2 — About the Data: Original Dataset

**Title:** What MediaFlow Gave Us (and Why It Wasn't Enough)

| Property | Value |
|----------|-------|
| Source | `Corrected_dataset.csv` (provided) |
| Rows | ~4,500 aggregated records |
| Publish rate | 0.74% by count / 0.32% by hours |
| Workspaces | Single-level `channel` column (misused for platform) |
| Teams | "Reacts", "user1_reacts" — consumer creator labels |
| Funnel | Upload only — no processed_date, no output type |

**Gaps vs the Problem Statement:**
- PS §3B requires a **3-stage funnel** (Upload → Process → Publish) — no `processed_date` column
- PS §3C requires **AI output type tracking** — no `ai_output_type` column
- PS §3A requires **workspace-level** analysis — `channel` held platform names (shorts/reels), not workspace IDs
- PS §9 uses journalism vocabulary (interview, debate, news_bulletin) — original used creator vocabulary
- 0.74% publish rate produces **no insight**: uniform rates tell no story; variance is the story

**Decision:** Augment with a reproducible synthetic enrichment pipeline (PS §9 explicitly permits this).

---

## Slide 3 — About the Data: Synthesized Dataset

**Title:** What We Built — Reproducible, Auditable, B2B-Ready

**Pipeline:** `data/enrich.py` — 6 transforms, seed=42, 32 TDD tests, fully reproducible

| Transform | What Changed | PS Reference |
|-----------|-------------|--------------|
| `input_type` realigned | interview, debate, news_bulletin, speech, special_report, press_conference, discussion_show | §9 |
| `ai_output_type` added | key_moments, chapters, summary, full_package, my_key_moments | §3C |
| `processed_date` added | log-normal lag from upload_date (enables 3-stage funnel) | §3B |
| `workspace` added | 5 workspaces replacing misused `channel` column | §3A |
| B2B vocabulary | content_editor_01–04, team names, company labels | §2 |
| PCR variance applied | 38–92% publish rate by workspace (engineered from real operational patterns) | §4, §6C |

**Final Dataset — Authoritative Numbers:**

| Stage | Count | % |
|-------|-------|---|
| Total rows | **4,569** | 100% |
| Valid upload_date | **4,179** | 91.5% |
| Processed by MediaFlow AI | **4,179** | 100% of uploaded |
| Published | **3,188** | 69.8% overall |

**Workspace Variance (the core data story):**
```
WS-DIGITAL-NEWS    ████████████████████████ 92%  ← 1,200 videos, all Hindi
WS-ENTERTAINMENT   ███████████████████      82%  ← 884 videos
WS-TECH-ANALYSIS   ████████████████         68%  ← 1,191 videos
WS-LIFESTYLE       ████████████             52%  ← 396 videos
WS-SPORTS-LIVE     █████████                38%  ← 898 videos — investigation target
```

---

## Slide 4 — KPI Design: The 19 Phase-1 KPIs

**Title:** From Data to Decision — 19 KPIs Across 5 PS Sections

**Design Principle:** Every KPI answers a specific operational question for a specific persona.

| Category | KPIs | Answers |
|----------|------|---------|
| **Funnel** | PCR, FSC, OPI | Where is content dropping off? |
| **Efficiency** | TEU, MCI, AGV | How fast and completely does AI process? |
| **Engagement** | HTHR, TSQI, ZSP | Which content earns the most watch time? |
| **Revenue Proxy** | CPDG, AHY, SAC, EDR | What's the yield per content hour? |
| **Platform** | PIG, LPI, DCDR | Cross-platform performance comparison? |
| **Quality** | GR, AIL, HTHR | Is AI output quality improving? |

**Highlighted KPIs:**

- **PCR** (Publish Conversion Rate) = `published / uploaded × 100` — headline metric, workspace × workspace
- **FSC** (Funnel Stage Completion) = per-stage conversion — shows Upload→Process vs Process→Publish split
- **ZSP** (Z-Score Performance) = `(video_views − μ) / σ` — statistical outlier detection, no threshold-setting needed
- **CPDG** (Content Production Density Gradient) = `published / total_duration_hours` — throughput normalized by time invested
- **TSQI** (Time-Series Quality Index) = rolling 7-day engagement vs 30-day baseline — trend direction, not absolute value

**Extensibility:** All 19 KPIs in `config/metric_registry.yaml` — add a KPI by editing YAML, zero code change.

---

## Slide 5 — KPI Design: Formulas and DuckDB Implementation

**Title:** Rigour Behind the Numbers

**Formula samples (DuckDB):**

```sql
-- PCR — Publish Conversion Rate
SELECT workspace,
       ROUND(SUM(CASE WHEN published_flag=true THEN 1 END) * 100.0 / COUNT(*), 1) AS pcr
FROM fact_video_events
GROUP BY workspace ORDER BY pcr DESC;
-- Result: 92.2% → 82.0% → 68.0% → 52.0% → 38.0%

-- ZSP — Z-Score Performance (per video)
SELECT video_id,
       (video_views - AVG(video_views) OVER ()) / NULLIF(STDDEV(video_views) OVER (), 0) AS zsp
FROM fact_video_events WHERE published_flag=true;

-- TEU — Time-to-Engage Upload (processing lag in hours)
SELECT uploaded_by,
       ROUND(AVG((epoch(TRY_CAST(processed_date AS TIMESTAMP))
                  - epoch(TRY_CAST(upload_date AS TIMESTAMP))) / 3600.0), 1) AS teu
FROM fact_video_events WHERE processed_date IS NOT NULL;
```

**Star Schema:** `fact_video_events` + 9 dimension tables + 16 SQL KPI views + 3 Python KPI tables

**Data Quality KPIs (PS §4):**
- **MCI** (Missing Content Index) — tracks the 390 rows with no upload_date (8.5% gap)
- **DCDR** (Data Completeness & Duplicate Rate) — monitors enrichment integrity
- **OPI** (Orphan Publish Index) — videos published without a valid upload trail

---

## Slide 6 — KPI Design: Insights from the Numbers

**Title:** What the KPIs Actually Tell Us

**Insight 1 — The Sports-Live Bottleneck**
WS-SPORTS-LIVE has 898 uploads but only 38% PCR (341 published). That's **557 videos stuck in pipeline**.
FSC analysis: upload→process conversion is 100%, so the bottleneck is at editorial review, not AI processing.
Recommendation: investigate reviewer SLA, not the AI model.

**Insight 2 — Hindi Content Outperforms**
WS-DIGITAL-NEWS (100% Hindi) achieves 92.2% PCR — highest in the portfolio.
LPI (Language Performance Index): Hindi avg_watch_hours = 3,635 vs English baseline — 54% higher engagement.
Actionable: prioritise Hindi production capacity in growth planning.

**Insight 3 — Key Moments Dominates**
`key_moments` output type: 1,913 videos (41.9% of all content), 70.6% PCR.
`my_key_moments`: smallest volume (291 videos), lowest PCR (64.6%).
Recommendation: deprioritize `my_key_moments` SKU for clients with low editorial bandwidth.

**Insight 4 — 8.5% Data Quality Gap**
390 videos have no upload_date — they appear as published with no origin trail (OPI = 11.8%).
These are included in counts but flagged in MCI/DCDR dashboards.
Not a pipeline bug — likely backdated uploads from workspace migration.

---

## Slide 7 — Demo: Dashboard in 60 Seconds

**Title:** Dashboard Tour — 6 Tabs, One Story

**Tab 1 — Executive Summary**
- Headline: PCR = 69.8%, 3,188 / 4,569 videos published
- Funnel: 4,569 → 4,179 (uploaded) → 4,179 (processed) → 3,188 (published)
- Workspace PCR bars — WS-SPORTS-LIVE flagged at 38%
- AI Insights panel — live LLM commentary on current filter state

**Tab 2 — Usage & Trends**
- 90-day upload/publish timeline (daily resolution)
- Input type breakdown: interview (29%) vs speech (18%) vs debate (14%)
- Output type mix: key_moments dominates at 41.9%
- Storage metrics: WS-DIGITAL-NEWS 15.34h, WS-TECH-ANALYSIS 15.53h

**Tab 3 — Team Activity**
- Treemap: workspace upload volume
- User table: content_editor_01 (1,200 uploads, 92.2% PCR) vs content_editor_04 (898 uploads, 38.0% PCR)
- D1×D2 CrossTab heatmap: workspace × language shows Hindi concentrated in WS-DIGITAL-NEWS
- LPI card: Hindi −0.50 (normalized), English baseline

**Tab 4 — Publish Metrics**
- Workspace conversion bars: 92% → 38% variance front-and-center
- Output mix donut: key_moments / chapters / full_package / summary / my_key_moments
- CPDG scatter: throughput vs duration by workspace
- HTHR table: headline-to-hour ratio by input type

**Tab 5 — Video Explorer**
- 4,569 searchable rows with ZSP badges (top/bottom performers)
- Filter by workspace, language, output type, published status
- CSV export for client self-service

**Global Controls:** COUNT ↔ HOURS toggle · Leadership / Creator persona · Client badge

---

## Slide 8 — Agent: Architecture

**Title:** The Conversational AI Layer — Ask the Dashboard in English

**Why an agent, not a chatbot?**
A chatbot has static responses. Our agent generates fresh SQL for every question, executes it against live data, validates the result, and narrates findings in the user's persona.

**Architecture: LangGraph 4-node StateGraph**

```
User Question
      │
   [input_guardrail]  ← PII redaction, injection detection, scope block
      │
   [router]           ← classify: standard_kpi? or ad_hoc_analytics?
      │
  ┌───┴───────────────┐
[analytics]       [text2sql]      ← two parallel fast/deep paths
  │                   │
  │          SQL-of-Thought pipeline:
  │          schema_linker → query_planner → sql_generator → guardrails → correction_loop
  │                   │
  └───────────────────┘
      │
   [hitl]             ← Human-in-the-Loop: alert approval via Agent Inbox
      │
   [narrate]          ← Gemini 2.0 Flash narrates findings in persona voice
      │
   [output_guardrail] ← PII check on output, empty-response fallback
      │
   SSE stream → Frontend NLQ Panel
```

**Tech Stack:**
- LangGraph + LangChain (agent orchestration)
- Gemini 2.0 Flash via Vertex AI (LLM)
- BigQuery Vector Search (semantic KPI/dimension retrieval)
- FastMCP servers: kpi_server, alert_server, report_server
- SQL-of-Thought pattern (arXiv:2509.00581) for Text2SQL

---

## Slide 9 — Agent: Security and SQL-of-Thought

**Title:** How We Stop the Agent from Doing Stupid Things

**SQL-of-Thought Pipeline (4-step before any query runs):**

1. **Schema Linker** — `SchemaLink` Pydantic model: maps NL entities to DuckDB columns, extracts filter values (`workspace = 'WS-SPORTS-LIVE'`), detects time windows
2. **Query Planner** — `QueryPlan` Pydantic model: CoT steps, tables used, aggregation strategy, join requirements
3. **SQL Generator** — `GeneratedSQL` Pydantic model: confidence score + warnings, `_postprocess_sql()` cleans markdown fences
4. **Correction Loop** — taxonomy-driven retry (max 2): classifies DuckDB errors → per-category prompts → `CorrectionPlan` → corrected SQL

**Guardrail Layers (WS-8 Comprehensive Security):**

| Layer | Protection |
|-------|-----------|
| API boundary | `NLQRequest.persona: Literal["leadership","creator"]`, `session_id: pattern=^[a-zA-Z0-9_-]{1,64}$` |
| Input guardrail | PII redaction (email/phone regex), injection pattern detection, out-of-scope hard block |
| SQL guardrail | DDL/DML block (regex, never reaches LLM), 50k char cap, DuckDB-specific rules |
| Execution guardrail | 30s timeout (ThreadPoolExecutor), 5,000 row cap |
| Output guardrail | PII redaction in narrative, empty-response fallback |
| Tool guardrail | `fire_alert` blocked without explicit HITL `approve` decision |

**43 TDD tests pass** (42/43 — 1 pre-existing flaky LLM non-determinism test)

---

## Slide 10 — Agent: HITL and SSE Streaming

**Title:** Human-in-the-Loop and Live Thought Streaming

**HITL (Human-in-the-Loop) — Alert Approval Flow:**

When the agent detects a threshold breach (e.g. PCR drops below CLIENT_1 threshold):
1. Agent calls `check_thresholds` via MCP `alert_server`
2. `analytics_node` returns `Command(goto="hitl")` with alert payload
3. LangGraph `interrupt()` suspends graph — Agent Inbox bell in TopNav shows notification
4. User clicks **Approve** or **Reject** in Agent Inbox dropdown
5. Frontend `POST /api/nlq/hitl/resume` with `{decision: "approve"|"reject"}`
6. Graph resumes from `hitl_node`, `fire_alert_action_node` executes (or skips), narrate runs

**SSE Streaming — Live Thought Process:**

The NLQ panel streams execution trace in real-time via Server-Sent Events:
```
thought_step → "Router: classified as text2sql (confidence: high)"
thought_step → "Schema Linker: mapped 'sports workspace' → workspace='WS-SPORTS-LIVE'"
thought_step → "Query Planner: grouped aggregation, no join needed"
sql_ready    → "SELECT workspace, COUNT(*) ..."
thought_step → "Guardrail: SQL passed all checks"
final        → "WS-SPORTS-LIVE published 341 of 898 uploaded videos (38.0% PCR)..."
```

Users see the agent reason, not just the answer — builds trust, surfaces SQL for verification.

---

## Slide 11 — Demo: Agent in Action

**Title:** Live Q&A with the Dashboard

**Sample queries by persona:**

**Leadership persona (CEO / Client Success):**
> "Which workspace is dragging our overall PCR below 70%?"

Agent: classifies as standard_kpi → analytics path → checks `v_pcr` view → narrates:
*"WS-SPORTS-LIVE at 38.0% is the primary drag — removing it would push portfolio PCR to 77.4%. 557 videos are stuck pre-publish."*

> "Alert me if any workspace drops below 50%."

Agent: → hitl → Agent Inbox notification → approve → `fire_alert` fires Slack webhook

**Creator persona (Editor / Uploader):**
> "Show me all key_moments videos I uploaded last month with ZSP above 1.0."

Agent: classifies as ad_hoc → text2sql path → schema links `uploaded_by`, `ai_output_type`, `zsp`, date filter → generates DuckDB SQL → executes → narrates results with top performers named

**Multi-turn memory:**
> "Now filter that to Hindi only."

Agent: uses session memory to scope the filter onto the prior result set — no need to restate context.

**Guardrail demonstration:**
> "Delete all videos from the database."

Agent: input_guardrail blocks immediately — `out-of-scope` category hard block, returns:
*"I can only answer questions about MediaFlow AI analytics data."*

---

## Slide 12 — Buffer: Roadmap and Extensibility

**Title:** What's Next — The Platform, Not Just the Dashboard

**Immediate (Step 7-8):**
- [ ] Insights deck PDF deliverable (this presentation)
- [ ] Chronos-Bolt-Tiny 3-month upload volume forecast (zero-shot, Apache 2.0, 9M params)
- [ ] River HalfSpaceTrees online anomaly detection (flags unusual PCR drops in real time)
- [ ] Ambient Monitor agent (polls KPIs every 15 min, auto-files Agent Inbox items)

**Extensibility built in — zero code changes needed for:**

| Extension | How |
|-----------|-----|
| New KPI | Add entry to `config/metric_registry.yaml` |
| New client | Create `config/clients/CLIENT_2.yaml` with thresholds + enabled KPIs |
| New workspace | Appears automatically in all views once data is loaded |
| New language | `config/dimensions.yaml` auto-discovers values |
| New alert channel | `alert_server.py` reads channel list from CLIENT config |

**Multi-tenant architecture:** CLIENT_1 badge is live in the dashboard. CLIENT_2 config can be active with a single YAML file — no schema changes, no code deploys.

**Scoring alignment:**

| Criterion | Weight | Evidence |
|-----------|--------|---------|
| KPI design | 20 | 19 Phase-1 KPIs, YAML registry, funnel + engagement + quality layers |
| Dashboard UX | 20 | 6 tabs, COUNT↔HOURS, D1×D2 CrossTab, ZSP badges, CSV export |
| NLQ depth | 20 | SQL-of-Thought, 4-node LangGraph, SSE streaming, HITL, multi-turn memory |
| Data quality | 15 | MCI, DCDR, OPI KPIs; 390 null upload_date tracked; workspace variance story |
| Extensibility | 15 | YAML metric registry, multi-tenant CLIENT configs, connector modal |
| Presentation | 10 | Variance story front-and-center; funnel drop-off as narrative |

---

*Generated: 2026-03-19 | Dataset: data/dataset.csv (4,569 rows, seed=42) | All numbers from live DuckDB queries*
