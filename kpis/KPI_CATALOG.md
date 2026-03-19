# KPI Catalog — MediaFlow AI Dashboard
> Complete catalog of all 42 KPIs from draft — 35 active (Phase 1 + Phase 2+), 7 documented as dropped.
> Source: `draft/Filtered_kpis.txt`, `draft/complete_kpis.txt`
> Active: 35 | Dropped (with full documentation): 7 — see Category F.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Phase 1 — implement in dashboard |
| 🔜 | Phase 2 — implement after Phase 1 |
| 🧠 | Agent/NL layer only — surface via query, not chart |
| `SQL` | Computable purely in DuckDB SQL |
| `PY` | Requires Python post-processing |

---

## Category A — MediaFlow Operational Metrics

### A1. Publish Conversion Rate (PCR) ✅ `SQL`
**Definition:** Percentage of uploaded videos that are eventually published.
**Formula:** `COUNT(published_flag = True) / COUNT(*) × 100`
**Dimensions:** workspace, team, input_type, language, month
**Roles:** Operations, CXO, Head of Content
**PS Section:** 6C — Publishing Funnel & Efficiency

---

### A2. Funnel Stage Conversion ✅ `SQL`
**Definition:** Volume and conversion rate across the Upload → Process → Publish pipeline.
**Formula:**
```
Upload count   = COUNT(*)
Process count  = COUNT(processed_date IS NOT NULL)
Publish count  = COUNT(published_flag = True)
Upload→Process = process_count / upload_count × 100
Process→Publish= publish_count / process_count × 100
```
**Dimensions:** workspace, team, input_type, month
**Roles:** Operations, CXO, Leadership
**PS Section:** 6C — Publishing Funnel

---

### A3. MoM / WoW Growth Rate ✅ `SQL`
**Definition:** Month-over-month and week-over-week % change in uploads and publishes.
**Formula:** `(current_period - prior_period) / prior_period × 100`
**Dimensions:** workspace, team, input_type, language
**Roles:** Leadership, CXO, Head of Content
**PS Section:** 6A — Usage & Adoption

---

### A4. Orphaned Processing Index (OPI) ✅ `SQL`
**Definition:** Total duration (hours) of content that has been processed but remains unpublished beyond 30 days.
**Formula:** `SUM(video_duration_sec / 3600) WHERE published_flag = False AND upload_date < today - 30`
**Dimensions:** workspace, team, input_type
**Roles:** Operations, Head of Content
**PS Section:** 6C — Drop-off identification

---

### A5. Time Efficiency of User (TEU) ✅ `SQL`
**Definition:** Average time gap (hours) between consecutive uploads per user — measures upload cadence consistency.
**Formula:** `AVG(upload_date[i] - upload_date[i-1]) per user`
**Dimensions:** uploaded_by, team, workspace
**Roles:** Operations, Head of Content
**PS Section:** 6D — Team/User insights

---

### A6. AI Output Leverage (AIL) ✅ `SQL`
**Definition:** Impressions generated per hour of source content fed into MediaFlow. Measures AI extraction efficiency.
**Formula:** `SUM(impressions) / SUM(video_duration_sec / 3600)` for published videos
**Dimensions:** workspace, ai_output_type, input_type
**Roles:** CXO, Founder, Product Head
**PS Section:** 6B — Output mix

---

### A7. Daily Production Rhythm Score (DPRS) 🔜 `PY`
**Definition:** Consistency of upload cadence over 4-week window using Coefficient of Variation. Low CV = high rhythm.
**Formula:** `CV = σ_D / μ_D; DPRS = 1 - min(CV, 1)` where D = daily upload count per user/team
**Dimensions:** uploaded_by, team_name
**Roles:** Operations, Editorial
**PS Section:** 6D — Team consistency

---

### A8. Resurrection Rate (RR) 🔜 `SQL`
**Definition:** % of published videos that were published more than 30 days after processing (delayed publishing).
**Formula:** `COUNT(published_flag=True AND processed_date < upload_date - 30d) / COUNT(published) × 100`
**Note:** Needs a separate `published_date` column. Currently approximated from upload_date patterns.
**Dimensions:** workspace, team, input_type
**Roles:** Operations, Head of Content
**PS Section:** 6C

---

## Category B — Content Performance Metrics

### B1. CPDG — Content Promise vs. Delivery Gap ✅ `PY`
**Definition:** Normalized gap between hook strength (CTR) and content delivery (avg view %). High score = clickbait risk.
**Formula:**
```
Z_CTR = (ctr_percentage - mean_ctr) / std_ctr
Z_AVP = (avg_view_percentage - mean_avp) / std_avp
CPDG_raw = Z_CTR - Z_AVP
CPDG = min-max normalize(CPDG_raw) to [0,1]
```
**Thresholds:** <0 = hidden gem | ~0 = balanced | 0.40+ = promise gap | 0.87+ = severe clickbait
**Dimensions:** video-level, then aggregated by input_type, workspace
**Roles:** Head of Content, Social Media Manager, CXO
**PS Section:** 6B — Content quality

---

### B2. Subscriber Attention Cost (SAC) ✅ `SQL`
**Definition:** Minutes of watch time required to acquire one new subscriber. Lower = more efficient conversion.
**Formula:** `(SUM(total_watch_time_hours) × 60) / SUM(subscribers_gained)`
**Dimensions:** workspace, team, input_type, output_type, traffic_source
**Roles:** Head of Content, Social Media Manager, CXO
**PS Section:** 6D — Performance efficiency

---

### B3. Attention Harvest Yield (AHY) ✅ `SQL`
**Definition:** Total watch hours returned per second of source content. Measures content extraction value.
**Formula:** `SUM(total_watch_time_hours) / SUM(video_duration_sec)`
**Dimensions:** workspace, input_type, ai_output_type
**Roles:** Head of Content, Social Media Manager, CXO
**PS Section:** 6B — Output value

---

### B4. Engagement Depth Rate (EDR) ✅ `SQL`
**Definition:** Proportion of impressions that result in active engagement (likes + comments + shares).
**Formula:** `SUM(likes + comments + shares) / SUM(impressions) × 100`
**Dimensions:** workspace, input_type, output_type, traffic_source
**Roles:** Head of Content, Social Media Manager
**PS Section:** 6B — Content engagement

---

### B5. Hook-to-Hold Resonance Score (HTHR) ✅ `SQL`
**Definition:** Combined signal for content-market fit — rewards high CTR, high retention, AND scale.
**Formula:** `ctr_percentage × avg_view_percentage × LOG10(impressions)`
**Dimensions:** video-level, then ranked by workspace/input_type
**Roles:** Marketing Director, Head of Content
**PS Section:** 6B — Top performing content

---

### B6. Z-Score Performance ✅ `PY`
**Definition:** Per-video performance relative to the company historical average (impressions as base metric).
**Formula:** `(video_impressions - company_avg_impressions) / company_std_impressions`
**Dimensions:** video-level, segmented by company
**Roles:** Head of Content, Social Media Manager
**PS Section:** 6B — Video-level insight

---

### B7. Subscriber Conversion (SC) 🔜 `SQL`
**Definition:** New subscribers gained per 1,000 impressions.
**Formula:** `SUM(subscribers_gained) / SUM(impressions) × 1000`
**Dimensions:** workspace, input_type, traffic_source
**Roles:** Growth Manager, Social Media Manager
**PS Section:** 6D

---

### B8. Shareability Index (SI) 🔜 `SQL`
**Definition:** Shares as a proportion of impressions — measures virality potential specifically.
**Formula:** `SUM(shares) / SUM(impressions) × 100`
**Dimensions:** workspace, input_type, output_type
**Roles:** Social Media Manager, Content Strategist
**PS Section:** 6B

---

### B9. Community Conversion Velocity (CCV) 🔜 `SQL`
**Definition:** Rate at which engagement converts to subscribers — distinguishes fleeting engagement from community building.
**Formula:** `SUM(subscribers_gained) × 100 / SUM(likes + comments + shares)`
**Dimensions:** workspace, input_type
**Roles:** Growth Manager, CXO
**PS Section:** 6D

---

### B10. Performance Momentum Index (PMI) 🔜 `SQL`
**Definition:** Week-over-week percentage change in aggregated performance metric (impressions or watch time).
**Formula:** `(M_current_week - M_prior_week) / M_prior_week × 100`
**Dimensions:** workspace, team, input_type
**Roles:** CXO, Head of Content, Growth Manager
**PS Section:** 6A — Trends

---

### B11. Performance Trajectory Ratio (PTR) 🔜 `SQL`
**Definition:** Current week performance as a ratio to 8-week rolling baseline — shows momentum direction.
**Formula:** `M_current / AVG(M_weeks[t-8:t-1])`
**Dimensions:** workspace, team
**Roles:** CXO, Leadership
**PS Section:** 6A — Long-term trajectory

---

### B12. Topic Category Performance Matrix (TCPM) 🔜 `SQL`
**Definition:** Geometric mean of watch time, retention, and virality per input_type — ranks content categories.
**Formula:**
```
WH_T  = AVG(total_watch_time_hours) by input_type
RET_T = AVG(avg_view_percentage) by input_type
VIR_T = AVG(shares / impressions × 10000) by input_type
TCPM  = (WH_T_norm × RET_T_norm × VIR_T_norm) ^ (1/3)
```
**Dimensions:** input_type, workspace
**Roles:** Editorial, Head of Content
**PS Section:** 6B — Content mix decisions

---

## Category C — Discovery & Distribution

### C1. Traffic Source Quality Index (TSQI) ✅ `SQL`
**Definition:** Average watch time per video across each traffic source — identifies which source drives deepest engagement.
**Formula:** `AVG(total_watch_time_hours) GROUP BY traffic_source`
**Dimensions:** traffic_source, input_type, workspace
**Roles:** Head of Content, Social Media Manager
**PS Section:** 6A — Discovery channels

---

### C2. Platform Impression Gap (PIG) ✅ `SQL`
**Definition:** Relative difference in average impressions between YouTube and Instagram.
**Formula:** `(AVG_impressions_YT - AVG_impressions_IG) / AVG_impressions_IG × 100`
**Dimensions:** published_platform
**Roles:** Head of Content, Social Media Manager
**PS Section:** 6D — Platform insights

---

### C3. Cross-Platform Arbitrage Index (CPAI) 🔜 `SQL`
**Definition:** Ratio of engagement rates across platforms — identifies where content punches above its weight.
**Formula:** `EDR(Platform_A) / EDR(Platform_B)` where EDR = (likes+comments+shares)/impressions × 100
**Dimensions:** published_platform, input_type
**Roles:** Social Media Strategist, Operations
**PS Section:** 6D

---

## Category D — Strategic / CXO Metrics

### D1. Audience Growth Velocity (AGV) ✅ `SQL`
**Definition:** Total subscribers gained per period + MoM growth rate — tracks audience building pace.
**Formula:** `SUM(subscribers_gained) per month; MoM = (AGV_N - AGV_(N-1)) / AGV_(N-1) × 100`
**Dimensions:** company, workspace, input_type
**Roles:** CXO, Founder, Head of Content
**PS Section:** 6A — Adoption

---

### D2. Language Performance Index (LPI) 🔜 `PY`
**Definition:** Identifies underleveraged language buckets by comparing average watch time and subscriber efficiency relative to volume share.
**Formula:**
```
WH_L  = AVG(total_watch_time_hours) by language
SAE_L = SUM(subscribers_gained) / SUM(impressions) × 1000 by language
VOL_L = COUNT(*) / COUNT(total) by language
ULI_L = (normalize(WH_L) + normalize(SAE_L)) / 2 - normalize(VOL_L)
```
**Dimensions:** language
**Roles:** CXO, Head of Content, Operations
**PS Section:** 6D

---

### D3. Total Digital Reach Score (TDRS) 🔜 `SQL`
**Definition:** Total estimated audience effectively reached — impressions weighted by view completion.
**Formula:** `SUM(impressions × avg_view_percentage / 100)` across all published videos
**Dimensions:** company, workspace, month
**Roles:** CXO, Founder
**PS Section:** 6A — Reach

---

### D4. Content-to-Reach Multiplier (CRM) 🔜 `SQL`
**Definition:** Impressions generated per hour of source content — measures AI amplification power.
**Formula:** `SUM(impressions) / SUM(video_duration_sec / 3600)` for published videos
**Dimensions:** company, workspace
**Roles:** CXO, Founder
**Note:** Similar to AIL but impressions-focused vs watch-time-focused.
**PS Section:** 6A

---

### D5. Channel Portfolio Balance Score (CPBS) 🔜 `PY`
**Definition:** How evenly watch hours are distributed across workspaces (Gini-based). 1 = perfectly balanced, 0 = all in one workspace.
**Formula:**
```
Gini(W) = (2 × SUM(rank_i × w_i) - (n+1) × SUM(w_i)) / (n × SUM(w_i))
CPBS = 1 - Gini(W)
```
**Dimensions:** workspace, company
**Roles:** CXO, Founder
**PS Section:** 6D

---

### D6. Audience Retention Gradient (ARG) 🔜 `PY`
**Definition:** Slope of average view percentage over 8-week rolling window — positive = improving retention, negative = declining.
**Formula:** `β₁` from OLS regression: `R_t = β₀ + β₁ × t + ε`
**Dimensions:** workspace, company
**Roles:** CXO, Head of Content
**PS Section:** 6A — Trends

---

### D7. Channel Health Scorecard (CHS) 🔜 `PY`
**Definition:** Composite 0–100 score across reach, retention, growth, virality, and publishing reliability. Weighted by variance contribution.
**Formula:**
```
sub-metrics: impressions MoM, avg_view_percentage, subscribers MoM,
             shares/impressions, publish conversion rate
weights: w_i = σ²_i / SUM(σ²_j)
CHS = 100 × SUM(w_i × normalize(metric_i))
```
**Dimensions:** workspace
**Roles:** CXO, Head of Content
**PS Section:** 6D — Dashboard summary card

---

## Category E — Data Quality

### E1. Metadata Completeness Index (MCI) ✅ `SQL`
**Definition:** % of published videos where each critical field is non-null and non-empty.
**Formula:**
```
MCI_field = COUNT(non-null, non-empty) / COUNT(published) × 100
MCI_overall = AVG(MCI across [headline, team_name, language, input_type,
                               upload_date, published_platform])
```
**Dimensions:** field-level, workspace, team
**Roles:** Tech/Product, Operations
**PS Section:** 6E — Data quality

---

### E2. Duplicate Content Detection Rate (DCDR) 🔜 `SQL`
**Definition:** % of video records that appear to be duplicates (same headline + same upload timestamp).
**Formula:** `COUNT(duplicate video_id or headline+date combos) / COUNT(*) × 100`
**Dimensions:** workspace, uploaded_by
**Roles:** Tech/Product, Operations
**PS Section:** 6E — Data quality

---

## Category F — Dropped KPIs (Documented for Reference)

> These KPIs were defined in the draft but excluded from implementation.
> Documented here with full formulas so context is not lost.

---

### F1. IHS — Integration Health Score ❌ `UNCOMPUTABLE`
**Definition:** Composite score measuring technical health of all MediaFlow system integrations (API uptime, call success rate, etc.).
**Formula:**
```
health_c = (successful_calls_c / total_calls_c) × 100
IHS = SUM_c(w_c × health_c)  where w_c derived from incident impact
```
**Why dropped:** Requires system-level API call logs (success/failure per integration). Not present in the video analytics dataset.
**If data available:** Would live in a Tech/Ops monitoring dashboard, not the analytics dashboard.

---

### F2. YAQBR — YouTube API Quota Burn Rate ❌ `UNCOMPUTABLE`
**Definition:** Tracks daily consumption of YouTube Data API quota relative to the 10,000 unit daily hard limit.
**Formula:**
```
YAQBR = (units_consumed_today / 10,000) × 100
hours_until_exhaustion = (10,000 - consumed_so_far) / burn_rate_per_hour
```
**Why dropped:** Requires YouTube API quota tracking data (platform-level infrastructure metric). Not derivable from video analytics records.
**If data available:** Useful for platform engineering team dashboards.

---

### F3. ACI — Audience Comment Intelligence ❌ `UNCOMPUTABLE`
**Definition:** Converts raw YouTube comments into editorial intelligence — sentiment score, request density, and discussion index per video/topic.
**Formula:**
```
SS_T  = COUNT(positive comments) / COUNT(total comments) × 100    (sentiment)
RD_T  = COUNT(comments with intent keywords) / COUNT(total) × 100  (request density)
DI_T  = AVG(reply_count_per_comment)                               (discussion index)
```
**Why dropped:** Requires raw comment text for NLP processing. Dataset only has `comments` as an integer count.
**If data available:** High-value KPI — would feed directly into editorial decisions. Worth adding if MediaFlow API provides comment text.

---

### F4. CCCI — Cross-Channel Coordination Index ❌ `UNCOMPUTABLE`
**Definition:** Measures how often a single piece of source content is republished across multiple MediaFlow workspaces.
**Formula:** `COUNT(source_videos published on > 1 workspace) / COUNT(distinct source videos) × 100`
**Why dropped:** `source_url` is obfuscated (`source_1`, `source_2`, …`source_N`) — cannot match the same source video across workspace rows. Requires un-obfuscated source identifiers.
**If data available:** Directly answers PS Section 6C cross-workspace reuse analysis.

---

### F5. CEI — Content Efficiency Index ❌ `REDUNDANT` → use AHY instead
**Definition:** Return on content production — watch time generated per unit of content duration.
**Formula:** `CEI = SUM(total_watch_time_hours) / SUM(video_duration_sec / 3600)`
**Why dropped:** Algebraically identical to AHY. CEI uses hours/hours (dimensionless ratio), AHY uses hours/seconds (per-second yield). Both measure the same thing. AHY retained as it has a more descriptive name and cleaner interpretation.
**Superseded by:** AHY (B3 in this catalog)

---

### F6. CTF — Content Thumbnail Fit ❌ `REDUNDANT` → use CPDG instead
**Definition:** Measures alignment between content discovery effectiveness (CTR) and delivery quality (avg view %).
**Formula:** `CTF = AVG((avg_view_percentage / 100) × ctr_percentage)` grouped by team/type
**Why dropped:** Captures the same hook-vs-delivery concept as CPDG but with a simpler (less rigorous) formula. CPDG uses Z-score normalization making it comparable across different content scales. CTF does not normalize, so high-volume content with naturally higher CTR distorts the score.
**Superseded by:** CPDG (B1 in this catalog)

---

### F7. HRYR — High-Retention Yield Rate ❌ `REDUNDANT` → use avg_view_percentage directly
**Definition:** Classifies content based on proportion of video duration consumed on average.
**Formula:** `Retention(%) = avg_view_duration_sec / video_duration_sec × 100`
**Why dropped:** This formula equals `avg_view_percentage` exactly — it is an existing column in the dataset, not a derived KPI. Treating it as a separate metric adds confusion without new information.
**Superseded by:** Direct use of `avg_view_percentage` column in all queries.
