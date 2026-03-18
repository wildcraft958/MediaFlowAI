# Data Assumptions & Decisions

## Source Data

The original Frammer dataset (retained in `draft/Frammer Data/`) was aggregated-only:
- 111 published videos total, no per-video performance metrics
- Aggregated by output type, input type, language, user, channel

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
terminology the PS explicitly specifies.

**Decision:** Reassigned using team-stratified weighted sampling, matching vocabulary from
the original Frammer data and PS Section 4/9.

**New values:** `interview`, `news_bulletin`, `special_report`, `speech`, `debate`,
`press_conference`, `discussion_show`

**Team weights rationale:**
| Team | Heavy types | Reasoning |
|------|-------------|-----------|
| Reacts | debate, discussion_show | Reaction content maps to debate/discussion formats |
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

**Problem:** PS requires Upload → Process → Publish funnel analysis. Original data only
had `upload_date` and `published_flag` — no processing timestamp.

**Decision:** Added `processed_date` = `upload_date` + AI processing lag.

**Lag distribution:** Log-normal (μ=ln(4), σ=0.8 hours), capped at 72h.
Rationale: Frammer AI processing is fast (most jobs <8h), with occasional long-tail
reruns or large files taking up to 72h.

**Actual stats (4,569 rows):** mean=5.4h, median=3.8h, max=72.0h

**Assumption:** All rows in the dataset have been processed (processed_flag implicitly True).
The 390 unpublished rows represent processed-but-not-published content.

---

## Change 4: New Column `frammer_workspace`

**Problem:** The `channel` column incorrectly contained the published platform
(Youtube/Instagram) — duplicating `published_platform`. In Frammer's data model,
"channel" means a client workspace, not the publish destination.

**Decision:** Dropped `channel`. Added `frammer_workspace` using (company, team) → workspace
mapping to represent the Frammer client workspace correctly.

**Workspace map:**
| company | team | frammer_workspace |
|---------|------|-------------------|
| Company_B | Reacts | WS-BR-Reacts |
| company_A | Music | WS-AM-Music |
| company_A | Tech | WS-AT-Tech |
| company_A | Gaming | WS-AG-Gaming |
| company_A | Vlog | WS-AV-Vlog |

---

## What Was NOT Changed

| Column | Reason kept as-is |
|--------|------------------|
| `video_id` | Unique identifier — unchanged |
| `headline` | Descriptive — acceptable for synthetic data |
| `published_flag` | 91.5% publish rate kept; high rate reflects well-curated digital media teams |
| `output_type` | Correctly represents published format (shorts/reels) |
| `published_platform` | Correctly represents destination (Youtube/Instagram) |
| All performance metrics | CTR, impressions, watch time, likes, etc. — core of KPI analysis |
| `language` | English/Hindi split matches original Frammer data |
| `team_name` | Retained as-is; documented as digital media team names |
| `uploaded_by` | Retained as-is |

---

## Final Schema (29 columns)

```
video_id, headline, source, source_url, published_flag, company,
uploaded_by, team_name, language,
input_type*,           ← CHANGED: PS-aligned vocabulary
output_type,           ← kept: published format (shorts/reels)
published_platform, published_url, billable_flag,
upload_date, video_duration_sec,
avg_view_duration_sec, avg_view_percentage, subscribers_gained,
traffic_source, ctr_percentage, impressions, likes, comments, shares,
total_watch_time_hours,
frammer_output_type*,  ← NEW: what Frammer AI created
processed_date*,       ← NEW: processing timestamp
frammer_workspace*     ← NEW: replaces channel (misused column dropped)
```
`*` = added or changed by enrich.py

---

## Reproducibility

```bash
cd GCAgent/
python data/enrich.py          # regenerates data/frammer_dataset.csv
python -m pytest data/test_enrich.py -v  # 32 tests, all pass
```

Seed: `42`. Given the same `Corrected_dataset.csv`, output is byte-identical.
