# Data Assumptions & Decisions

## Source Data

The original Frammer dataset (retained in `draft/Frammer Data/`) was aggregated-only:
- 111 published videos total, no per-video performance metrics
- Aggregated by output type, input type, language, user, channel
- **These numbers (0.74% publish rate, 111 published) are from the original data only.
  They do NOT apply to our enriched synthetic dataset.**

As permitted by the problem statement, a richer synthetic dataset (`Corrected_dataset.csv`)
was created as the foundation. This file documents every enrichment decision applied on top
of it to produce the final `frammer_dataset.csv`.

**Original Frammer data role:** Domain reference for vocabulary, input/output type
proportions, and structural schema — not the primary analysis dataset.

---

## Enrichment Pipeline

Script: `data/enrich.py` | Seed: `42` | Tests: `data/test_enrich.py` (32 tests, all pass)

---

## Change 1: `input_type` — Realigned to PS Vocabulary

**Problem:** Original synthetic values (`long_videos`, `streams`, `music_challenges`,
`music_videos`, `original_long_videos`) were consumer-creator vocabulary, not the B2B media
terminology the PS explicitly specifies (Section 9: "speech, interview, special report, etc.").

**Decision:** Reassigned using team-stratified weighted sampling, matching vocabulary from
the original Frammer data and PS Section 4/9.

**New values:** `interview`, `news_bulletin`, `special_report`, `speech`, `debate`,
`press_conference`, `discussion_show`

**Team weights rationale:**
| Team (original) | Heavy types | Reasoning |
|-----------------|-------------|-----------|
| Reacts | debate, discussion_show | Reaction/panel content maps to debate/discussion formats |
| Music | interview, special_report | Entertainment interviews and artist profiles |
| Tech | interview, speech, special_report | Product launches, talks, analysis pieces |
| Gaming | interview, debate, discussion_show | Esports commentary and panel formats |
| Vlog | interview, speech, special_report | Personality-driven informational content |

**Base proportions** cross-validated against original Frammer data:
interview 28%, news_bulletin 23%, special_report 17%, speech 17%, debate 7%,
press_conference 5%, discussion_show 3%

**Final distribution (4,569 rows):**
interview 1,462 | special_report 690 | debate 685 | speech 605 |
discussion_show 580 | press_conference 310 | news_bulletin 237

---

## Change 2: New Column `frammer_output_type`

**Problem:** `output_type` only captured the *published format* (shorts/reels).
The PS requires tracking what Frammer AI *created* — key moments, chapters, summaries, etc.
(PS Section 3C, Section 6B).

**Decision:** Added `frammer_output_type` as a separate column representing the
Frammer-generated asset type. `output_type` (shorts/reels/published format) retained as-is.

**Relationship:**
```
Source video (input_type) → Frammer AI → frammer_output_type
frammer_output_type → published as → output_type (shorts/reels) on published_platform
```

**Values:** `key_moments`, `chapters`, `full_package`, `summary`, `my_key_moments`

**Input-output correlations:**
| input_type | Most likely frammer_output_type |
|------------|--------------------------------|
| interview | key_moments (50%) |
| speech | summary (40%) |
| special_report | key_moments (35%), chapters (30%) |
| debate | key_moments (45%) |
| news_bulletin | key_moments (40%), full_package (30%) |
| press_conference | key_moments (35%), summary (30%) |
| discussion_show | key_moments (40%), chapters (25%) |

**Cross-validated against original Frammer data proportions:**
key_moments ~43%, full_package ~30%, chapters ~13%, my_key_moments ~8%, summary ~6%

**Actual output (seeded):**
key_moments 1,913 | chapters 906 | full_package 831 | summary 628 | my_key_moments 291

---

## Change 3: New Column `processed_date`

**Problem:** PS requires Upload → Process → Publish funnel analysis (Section 3B, 6C).
Original data only had `upload_date` and `published_flag` — no processing timestamp.

**Decision:** Added `processed_date` = `upload_date` + AI processing lag.

**Lag distribution:** Log-normal (μ=ln(4), σ=0.8 hours), capped at 72h.
Rationale: Frammer AI processing is fast (most jobs finish in <8h), with occasional long-tail
reruns or large files taking up to 72h.

**Actual stats (4,179 rows with valid upload_date):** mean=5.4h, median=3.8h, max=72.0h

**Note:** 390 rows in Corrected_dataset.csv have empty `upload_date` (data quality gap).
These rows get NaT for `upload_date` and `processed_date` after enrichment.
They remain in the dataset as a data quality signal (visible in MCI, OPI KPIs).

---

## Change 4: New Column `frammer_workspace`

**Problem:** The `channel` column incorrectly contained the published platform
(Youtube/Instagram) — duplicating `published_platform`. In Frammer's data model,
"channel" means a client workspace, not the publish destination.

**Decision:** Dropped `channel`. Added `frammer_workspace` using (company, team) → workspace
mapping to represent the Frammer client workspace correctly.

**Workspace map (uses original team names from source CSV — renamed in Change 5):**
| company | team (original) | frammer_workspace |
|---------|----------------|-------------------|
| Company_B | Reacts | WS-DIGITAL-NEWS |
| company_A | Music | WS-ENTERTAINMENT |
| company_A | Tech | WS-TECH-ANALYSIS |
| company_A | Gaming | WS-SPORTS-LIVE |
| company_A | Vlog | WS-LIFESTYLE |

---

## Change 5: B2B Label Alignment (`team_name`, `uploaded_by`, `company`)

**Problem:** Original team names (Reacts, Music, Gaming) and user names (user1_reacts,
user2_music) read as YouTube creator/consumer vocabulary. The PS explicitly describes
Frammer AI as a **B2B platform** used by media operations teams (news channels, broadcast
companies). A dashboard demo showing "user1_reacts" as an operator is a narrative mismatch.

**Decision:** Renamed to neutral B2B media operations labels. Applied AFTER workspace
assignment (so workspace keys resolve correctly against original names).

Also fixed: `company_A` → `Company_A` (inconsistent casing from source data).

**Rename map:**
| Original `team_name` | New `team_name` |
|---------------------|----------------|
| Reacts | Digital_News |
| Music | Entertainment |
| Tech | Tech_Analysis |
| Gaming | Sports_Live |
| Vlog | Lifestyle |

| Original `uploaded_by` | New `uploaded_by` |
|------------------------|------------------|
| user1_reacts | content_editor_01 |
| user2_music | content_editor_02 |
| user3_tech_vlog | content_editor_03 |
| user4_gaming | content_editor_04 |

**Note:** Workspace IDs (WS-BR-Reacts, WS-AG-Gaming etc.) are NOT changed — they retain
the original context and serve as workspace identifiers in the DB.

---

## Change 6: Channel-Level Publish Variance (`published_flag`)

**Problem:** With 91.5% uniform publish rate across all workspaces, the PS Section 6C
requirement — "Which channels process high volume but publish low?" and
"High-volume / low-publish patterns" — has no answer. Every PCR KPI read ~91%.
No underperforming channel story possible.

**Decision:** Assigned target publish-conversion rates per workspace using seeded sampling.
Excess published rows are flipped to `published_flag=False` and their platform metrics
(output_type, published_platform, impressions, CTR, etc.) are cleared to NaN — consistent
with how unpublished rows look: video was processed by Frammer AI but client never pushed it
to a platform.

**Target rates (seed=42):**
| Workspace | Target PCR | Narrative |
|-----------|-----------|-----------|
| WS-DIGITAL-NEWS | 95% | Top publisher — news team ships quickly |
| WS-ENTERTAINMENT | 82% | Healthy — solid editorial pipeline |
| WS-TECH-ANALYSIS | 68% | Moderate — tech pieces need editorial review |
| WS-LIFESTYLE | 52% | Weak — vlog quality is variable, many held back |
| WS-SPORTS-LIVE | 38% | Lowest — live clips go stale before approval |

**Actual achieved rates:** WS-DIGITAL-NEWS 92% | WS-ENTERTAINMENT 82% | WS-TECH-ANALYSIS 68% |
WS-LIFESTYLE 52% | WS-SPORTS-LIVE 38%

(WS-DIGITAL-NEWS ends at 92% instead of 95% because the workspace's original published count
was already below the 95% target — algorithm only flips published→unpublished, never the reverse.)

**Overall publish rate after adjustment:** 3,188 / 4,569 = **69.8%** (was 91.5%)

**PS references:** Section 4 ("high-volume / low-publish patterns"), Section 6C
("Which channels process high volume but publish low?")

---

## Change 8: `billable_flag` — Billing Analytics

**Problem:** `billable_flag` was 100% null, making PS §8C ("billable vs non-billable analytics") unqueryable.

**Decision:** Set `billable_flag` to match `published_flag`. Published content = billable usage for the client (the video was processed by Frammer AI and approved for distribution). Unpublished videos consumed AI processing but generated no publishable output — they may be billable at a lower rate in reality, but using `published_flag` as a proxy gives a clear, defensible split that enables billing analytics without additional data.

**Implementation:** `out["billable_flag"] = out["published_flag"].map({True: "True", False: "False"})` — stored as VARCHAR to match existing schema conventions (all flag columns are VARCHAR).

**Result:** 3,188 billable (69.8%) / 1,381 non-billable (30.2%) — meaningful billing split across all 5 workspaces.

**PS reference:** Section 8C ("billable vs non-billable usage analytics")

---

## What Was NOT Changed

| Column | Reason kept as-is |
|--------|------------------|
| `video_id` | Unique identifier — unchanged |
| `headline` | Descriptive — acceptable for synthetic data |
| `output_type` | Correctly represents published format (shorts/reels) |
| `published_platform` | Correctly represents destination (Youtube/Instagram); cleared for unpublished rows in Change 6 |
| Performance metrics | CTR, impressions, watch time, likes, etc. — preserved for published rows; cleared for rows flipped unpublished in Change 6 |
| `language` | English/Hindi split matches original Frammer data |

---

## Final Dataset Facts (after all 6 changes, seed=42)

| Metric | Value |
|--------|-------|
| Total rows | 4,569 |
| Rows with valid upload_date | 4,179 (91.5%) |
| Rows with processed_date | 4,179 (same — all uploaded videos are processed) |
| Published rows | 3,188 (69.8% overall) |
| Per-workspace PCR | 92% / 82% / 68% / 52% / 38% |
| Input types | 7 (interview, speech, debate, news_bulletin, special_report, press_conference, discussion_show) |
| Frammer output types | 5 (key_moments, chapters, full_package, summary, my_key_moments) |
| Languages | 2 (English, Hindi) |
| Workspaces | 5 |
| Companies | 2 (Company_A, Company_B) |

---

## Final Schema (29 columns)

```
video_id, headline, source, source_url,
published_flag*,       ← CHANGED: channel-level variance applied (Change 6)
company*,              ← CHANGED: casing fixed company_A → Company_A (Change 5)
uploaded_by*,          ← CHANGED: B2B labels (Change 5)
team_name*,            ← CHANGED: B2B labels (Change 5)
language,
input_type*,           ← CHANGED: PS-aligned vocabulary (Change 1)
output_type*,          ← CHANGED: cleared for rows flipped unpublished (Change 6)
published_platform*,   ← CHANGED: cleared for rows flipped unpublished (Change 6)
published_url, billable_flag,
upload_date, video_duration_sec,
avg_view_duration_sec*, avg_view_percentage*, subscribers_gained*,
traffic_source*, ctr_percentage*, impressions*, likes*, comments*, shares*,
total_watch_time_hours*,  ← CHANGED: cleared for rows flipped unpublished (Change 6)
frammer_output_type*,  ← NEW: what Frammer AI created (Change 2)
processed_date*,       ← NEW: processing timestamp (Change 3)
frammer_workspace*     ← NEW: replaces channel (Change 4)
```
`*` = added or changed by enrich.py

---

## Change 7: Date Shift — Rolling Window Alignment

**Problem:** The synthetic dataset was generated with `upload_date` spanning
2024-11-19 → 2025-11-19. Once real calendar time advanced past 2025-11-19, the
dashboard's 90-day rolling trend chart returned 0 rows — all data was outside
the window. This made the Usage & Trends tab and all time-series features invisible.

**Decision:** Shift all timestamps forward so `max(upload_date)` equals today's date
at midnight. This preserves the full 1-year data span and all relative durations;
only the absolute dates change.

**Script:** `data/shift_dates.py`
```bash
python data/shift_dates.py   # shifts CSV + rebuilds frammer.duckdb
```

**Shift applied (2026-03-19):** +119 days
- `upload_date`:    2024-11-19 → 2025-11-19  →  2025-03-19 → 2026-03-19
- `processed_date`: shifted by same offset (preserves upload→process lag)

**Key property:** Because the shift is derived as `today - max(upload_date)`,
re-running `shift_dates.py` on any future date will re-align the window to
that new date. The script is idempotent.

**PS rationale:** The problem statement explicitly permits synthetic data
(Section 9). Date alignment is a presentation-only adjustment; no analytical
values (PCR, TEU, ZSP, etc.) are affected.

**`/api/trends/daily` default:** `days=90` (natural 90-day window now covers
real data). The earlier workaround (`days=500`) has been reverted.

---

## Reproducibility

```bash
cd GCAgent/
python data/enrich.py           # regenerates data/frammer_dataset.csv
python data/shift_dates.py      # shifts dates to rolling window (run after enrich)
python -m pytest data/test_enrich.py -v  # 32 tests, all pass
python data/schema.py           # rebuilds frammer.duckdb from frammer_dataset.csv
```

Seed: `42`. Given the same `Corrected_dataset.csv`, `enrich.py` output is byte-identical.
`shift_dates.py` output depends on the current date — run it to re-align to today.
