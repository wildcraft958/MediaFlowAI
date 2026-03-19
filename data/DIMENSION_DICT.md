# Dimension Dictionary
> PS mandatory deliverable (Section 7.2) — documents all filter/drill-down dimensions
> available in the dashboard.
> Source: `data/frammer_dataset.csv` (4,569 rows, 29 columns, seed=42)

---

## Dimensions

| Dimension | Source Column | DuckDB Table | Description | Cardinality | Values |
|-----------|--------------|-------------|-------------|-------------|--------|
| Workspace | `frammer_workspace` | `dim_workspace` | Client workspace / channel identifier | 5 | WS-DIGITAL-NEWS, WS-ENTERTAINMENT, WS-TECH-ANALYSIS, WS-LIFESTYLE, WS-SPORTS-LIVE |
| Company | `company` | `dim_workspace` | Parent company | 2 | Company_A, Company_B |
| Team | `team_name` | `dim_team` | Editorial team | 5 | Digital_News, Entertainment, Tech_Analysis, Sports_Live, Lifestyle |
| User | `uploaded_by` | `dim_user` | Operator who uploaded the video | 4 | content_editor_01, content_editor_02, content_editor_03, content_editor_04 |
| Language | `language` | `dim_language` | Content language | 2 | English, Hindi |
| Input Type | `input_type` | `dim_input_type` | Source content category (PS vocabulary) | 7 | interview, speech, debate, news_bulletin, special_report, press_conference, discussion_show |
| Frammer Output Type | `frammer_output_type` | `dim_frammer_output_type` | AI-generated content package (what Frammer created) | 5 | key_moments, chapters, full_package, summary, my_key_moments |
| Output Type | `output_type` | `dim_output_type` | Published format on distribution platform | 2 | shorts, reels |
| Platform | `published_platform` | `dim_platform` | Distribution platform | 2 | Youtube, Instagram |
| Date | `upload_date` | `dim_date` | Upload timestamp — continuous | continuous | 2024-11-19 … 2025-11-xx |

---

## Date Sub-Dimensions

The `dim_date` table derives the following sub-dimensions from `upload_date`:

| Sub-Dimension | DuckDB Expression | Use |
|--------------|------------------|-----|
| Year | `EXTRACT(YEAR FROM upload_date)` | Annual trend |
| Month | `EXTRACT(MONTH FROM upload_date)` | MoM growth (GR KPI) |
| Week | `EXTRACT(WEEK FROM upload_date)` | WoW momentum (PMI KPI) |
| Quarter | `EXTRACT(QUARTER FROM upload_date)` | Quarterly reporting |
| Day of Week | `EXTRACT(DOW FROM upload_date)` | Editorial cadence analysis |

---

## Pipeline Status Flags

Used as filters throughout the dashboard — not standalone dimensions but key segmentation fields.

| Flag | Column | Values | Notes |
|------|--------|--------|-------|
| Published | `published_flag` | True / False | Varies 38–92% by workspace (by design — see ASSUMPTIONS.md Change 6) |
| Billable | `billable_flag` | True / False | Frammer billing status, independent of publish status |

---

## Workspace → Team → User Mapping

```
Company_A
├── WS-ENTERTAINMENT  → team: Entertainment  → content_editor_02
├── WS-TECH-ANALYSIS  → team: Tech_Analysis  → content_editor_03 (shared)
├── WS-SPORTS-LIVE    → team: Sports_Live    → content_editor_04
└── WS-LIFESTYLE      → team: Lifestyle      → content_editor_03 (shared)

Company_B
└── WS-DIGITAL-NEWS   → team: Digital_News  → content_editor_01
```

Note: content_editor_03 serves both WS-TECH-ANALYSIS and WS-LIFESTYLE — 4 users across 5 workspaces.

---

## Multi-Dimension Drill-Down Support (PS Section 5)

The dashboard must support D1 × D2 CrossTab analysis. All dimensions above can be combined:

| Example | D1 | D2 | Metric |
|---------|----|----|--------|
| Channel × Input Type | frammer_workspace | input_type | video count / hours |
| Channel × Language | frammer_workspace | language | video count |
| User × Output Type | uploaded_by | frammer_output_type | published count |
| Team × Platform | team_name | published_platform | impressions |
| Workspace × Published Status | frammer_workspace | published_flag | PCR % |

---

## Data Quality Notes

| Issue | Detail | KPI |
|-------|--------|-----|
| 390 rows with null upload_date / processed_date | These rows have no upload tracking — data quality gap | MCI, OPI |
| Channel-level publish variance | 38–92% PCR by design — see ASSUMPTIONS.md Change 6 | PCR, FSC |
| 2 languages only | English/Hindi — less diverse than original Frammer data | LPI |
| Consistent company casing | Fixed company_A → Company_A in enrichment | — |
