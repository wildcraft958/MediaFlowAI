# KPI Final List — Phase 1 Implementation
> 19 KPIs selected for Phase 1 dashboard + agent.
> Selection criteria: directly answers a PS Section 6 objective, computable with
> `data/media_dataset.csv`, non-redundant, surfaceable in a dashboard chart or NL query.
> Full catalog (35 KPIs) → `kpis/KPI_CATALOG.md`

---

## Quick Reference

| # | KPI | Acronym | Type | Dashboard Page | PS Section | Roles |
|---|-----|---------|------|----------------|------------|-------|
| 1 | Publish Conversion Rate | PCR | SQL | Funnel | 6C | CXO, Manager |
| 2 | Funnel Stage Conversion | FSC | SQL | Funnel | 6C | CXO, Manager |
| 3 | MoM / WoW Growth Rate | GR | SQL | Executive Summary | 6A | CXO, Manager |
| 4 | Content-to-Reach Multiplier | CRM | SQL | Executive Summary | 6B | CXO, Manager |
| 5 | Time Efficiency of User | TEU | SQL | Team Activity | 6D | Manager |
| 6 | AI Output Leverage | AIL | SQL | Executive Summary | 6B | CXO |
| 7 | Content Promise vs Delivery Gap | CPDG | PY | Publish Metrics | 6B | Manager, Analyst |
| 8 | Subscriber Attention Cost | SAC | SQL | Publish Metrics | 6D | Manager, Analyst |
| 9 | Attention Harvest Yield | AHY | SQL | Publish Metrics | 6B | CXO, Manager, Analyst |
| 10 | Engagement Depth Rate | EDR | SQL | Publish Metrics | 6B | Manager, Analyst |
| 11 | Hook-to-Hold Resonance Score | HTHR | SQL | Publish Metrics | 6B | Manager, Analyst |
| 12 | Z-Score Performance | ZSP | PY | Video Explorer | 6B | Manager, Analyst |
| 13 | Traffic Source Quality Index | TSQI | SQL | Usage Trends | 6A | Manager, Analyst |
| 14 | Platform Impression Gap | PIG | SQL | Usage Trends | 6D | Manager, Analyst |
| 15 | Audience Growth Velocity | AGV | SQL | Executive Summary | 6A | CXO, Manager |
| 16 | Performance Momentum Index | PMI | SQL | Executive Summary | 6A | CXO, Manager, Analyst |
| 17 | Language Performance Index | LPI | PY | Team Activity | 6D | CXO, Manager, Analyst |
| 18 | Metadata Completeness Index | MCI | SQL | Data Quality | 6E | Analyst |
| 19 | Duplicate Detection Rate | DCDR | SQL | Data Quality | 6E | Analyst |

---

## Formulas

### 1. Publish Conversion Rate (PCR)
```sql
SELECT
    workspace,
    COUNT(*) AS total_uploaded,
    SUM(CASE WHEN published_flag = true THEN 1 ELSE 0 END) AS total_published,
    ROUND(SUM(CASE WHEN published_flag = true THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS pcr_pct
FROM media_dataset
GROUP BY workspace
```

---

### 2. Funnel Stage Conversion (FSC)
```sql
SELECT
    workspace,
    COUNT(*) AS uploaded,
    COUNT(processed_date) AS processed,
    SUM(CASE WHEN published_flag = true THEN 1 ELSE 0 END) AS published,
    ROUND(COUNT(processed_date) * 100.0 / COUNT(*), 2) AS upload_to_process_pct,
    ROUND(SUM(CASE WHEN published_flag = true THEN 1 ELSE 0 END) * 100.0
          / NULLIF(COUNT(processed_date), 0), 2) AS process_to_publish_pct
FROM media_dataset
GROUP BY workspace
```

---

### 3. MoM / WoW Growth Rate (GR)
```sql
-- Monthly uploads growth
SELECT
    DATE_TRUNC('month', TRY_CAST(upload_date AS TIMESTAMP)) AS month,
    COUNT(*) AS uploads,
    LAG(COUNT(*)) OVER (ORDER BY DATE_TRUNC('month', TRY_CAST(upload_date AS TIMESTAMP))) AS prev_month,
    ROUND((COUNT(*) - LAG(COUNT(*)) OVER (ORDER BY DATE_TRUNC('month', TRY_CAST(upload_date AS TIMESTAMP))))
          * 100.0 / NULLIF(LAG(COUNT(*)) OVER (
              ORDER BY DATE_TRUNC('month', TRY_CAST(upload_date AS TIMESTAMP))), 0), 2) AS mom_growth_pct
FROM media_dataset
GROUP BY 1
ORDER BY 1
```

---

### 4. Content-to-Reach Multiplier (CRM)
```sql
SELECT
    workspace,
    ROUND(SUM(TRY_CAST(impressions AS DOUBLE)), 0) AS total_impressions,
    ROUND(SUM(video_duration_sec) / 3600.0, 2) AS source_duration_hours,
    ROUND(
        SUM(TRY_CAST(impressions AS DOUBLE))
        / NULLIF(SUM(video_duration_sec) / 3600.0, 0)
    , 2) AS crm
FROM media_dataset
WHERE published_flag = true
GROUP BY workspace
ORDER BY crm DESC
```
**Interpretation:** Impressions per hour of raw source content. Rising CRM = AI + editorial getting more efficient. Benchmark: 1 hour news content = 20-50 lakh impressions for large Indian news channels.

---

### 5. Time Efficiency of User (TEU)
```sql
-- Average hours between consecutive uploads per user
SELECT
    uploaded_by,
    team_name,
    ROUND(AVG(gap_hours), 2) AS avg_upload_gap_hours,
    ROUND(STDDEV(gap_hours), 2) AS stddev_gap_hours,
    COUNT(*) AS upload_count
FROM (
    SELECT
        uploaded_by,
        team_name,
        EXTRACT(EPOCH FROM (
            TRY_CAST(upload_date AS TIMESTAMP)
            - LAG(TRY_CAST(upload_date AS TIMESTAMP)) OVER (PARTITION BY uploaded_by ORDER BY upload_date)
        )) / 3600.0 AS gap_hours
    FROM media_dataset
) sub
WHERE gap_hours IS NOT NULL
GROUP BY uploaded_by, team_name
```

---

### 6. AI Output Leverage (AIL)
```sql
SELECT
    workspace,
    ai_output_type,
    ROUND(SUM(impressions) / NULLIF(SUM(video_duration_sec / 3600.0), 0), 2) AS impressions_per_source_hour
FROM media_dataset
WHERE published_flag = true
GROUP BY workspace, ai_output_type
ORDER BY impressions_per_source_hour DESC
```

---

### 7. CPDG — Content Promise vs. Delivery Gap
```python
# Requires Python — Z-score normalization then min-max scale
import duckdb, pandas as pd, numpy as np

df = duckdb.sql("SELECT video_id, ctr_percentage, avg_view_percentage FROM media_dataset WHERE published_flag=true").df()
df = df.dropna(subset=['ctr_percentage', 'avg_view_percentage'])

df['z_ctr'] = (df['ctr_percentage'] - df['ctr_percentage'].mean()) / df['ctr_percentage'].std()
df['z_avp'] = (df['avg_view_percentage'] - df['avg_view_percentage'].mean()) / df['avg_view_percentage'].std()
df['cpdg_raw'] = df['z_ctr'] - df['z_avp']
df['cpdg'] = (df['cpdg_raw'] - df['cpdg_raw'].min()) / (df['cpdg_raw'].max() - df['cpdg_raw'].min())
# cpdg < 0 = hidden gem | ~0 = balanced | 0.40+ = promise gap | 0.87+ = severe clickbait
```

---

### 8. Subscriber Attention Cost (SAC)
```sql
SELECT
    workspace,
    input_type,
    ROUND(SUM(total_watch_time_hours) * 60.0 / NULLIF(SUM(subscribers_gained), 0), 2) AS minutes_per_subscriber
FROM media_dataset
WHERE published_flag = true
GROUP BY workspace, input_type
ORDER BY minutes_per_subscriber ASC
```

---

### 9. Attention Harvest Yield (AHY)
```sql
SELECT
    workspace,
    ai_output_type,
    ROUND(SUM(total_watch_time_hours) / NULLIF(SUM(video_duration_sec), 0), 6) AS watch_hours_per_source_second
FROM media_dataset
WHERE published_flag = true
GROUP BY workspace, ai_output_type
```

---

### 10. Engagement Depth Rate (EDR)
```sql
SELECT
    workspace,
    input_type,
    ROUND(SUM(likes + comments + shares) * 100.0 / NULLIF(SUM(impressions), 0), 4) AS edr_pct
FROM media_dataset
WHERE published_flag = true
GROUP BY workspace, input_type
ORDER BY edr_pct DESC
```

---

### 11. Hook-to-Hold Resonance Score (HTHR)
```sql
SELECT
    video_id,
    headline,
    input_type,
    workspace,
    ROUND(ctr_percentage * avg_view_percentage * LOG10(impressions), 4) AS hthr_score
FROM media_dataset
WHERE published_flag = true
  AND impressions > 0
ORDER BY hthr_score DESC
```

---

### 12. Z-Score Performance (ZSP)
```python
import duckdb, pandas as pd, numpy as np

df = duckdb.sql("""
    SELECT video_id, headline, company, impressions
    FROM media_dataset WHERE published_flag=true
""").df().dropna(subset=['impressions'])

df['zsp'] = df.groupby('company')['impressions'].transform(
    lambda x: (x - x.mean()) / x.std()
)
# zsp > 1.5 = top performer | < -1.5 = underperformer
```

---

### 13. Traffic Source Quality Index (TSQI)
```sql
SELECT
    traffic_source,
    COUNT(*) AS video_count,
    ROUND(AVG(total_watch_time_hours), 2) AS avg_watch_hours,
    ROUND(AVG(avg_view_percentage), 2) AS avg_retention_pct,
    ROUND(AVG(subscribers_gained), 2) AS avg_subscribers
FROM media_dataset
WHERE published_flag = true AND traffic_source != ''
GROUP BY traffic_source
ORDER BY avg_watch_hours DESC
```

---

### 14. Platform Impression Gap (PIG)
```sql
SELECT
    published_platform,
    COUNT(*) AS video_count,
    ROUND(AVG(impressions), 0) AS avg_impressions,
    ROUND(AVG(ctr_percentage), 2) AS avg_ctr,
    ROUND(AVG(avg_view_percentage), 2) AS avg_retention
FROM media_dataset
WHERE published_flag = true AND published_platform != ''
GROUP BY published_platform
```

---

### 15. Audience Growth Velocity (AGV)
```sql
SELECT
    company,
    DATE_TRUNC('month', TRY_CAST(upload_date AS TIMESTAMP)) AS month,
    SUM(subscribers_gained) AS monthly_subscribers,
    LAG(SUM(subscribers_gained)) OVER (PARTITION BY company
        ORDER BY DATE_TRUNC('month', TRY_CAST(upload_date AS TIMESTAMP))) AS prev_month_subs,
    ROUND((SUM(subscribers_gained) - LAG(SUM(subscribers_gained)) OVER (
        PARTITION BY company ORDER BY DATE_TRUNC('month', TRY_CAST(upload_date AS TIMESTAMP))))
        * 100.0 / NULLIF(LAG(SUM(subscribers_gained)) OVER (
        PARTITION BY company ORDER BY DATE_TRUNC('month', TRY_CAST(upload_date AS TIMESTAMP))), 0), 2)
    AS mom_growth_pct
FROM media_dataset
GROUP BY company, DATE_TRUNC('month', TRY_CAST(upload_date AS TIMESTAMP))
ORDER BY company, month
```

---

### 16. Performance Momentum Index (PMI)
```sql
SELECT
    workspace,
    DATE_TRUNC('week', TRY_CAST(upload_date AS TIMESTAMP)) AS week,
    SUM(impressions) AS weekly_impressions,
    LAG(SUM(impressions)) OVER (PARTITION BY workspace
        ORDER BY DATE_TRUNC('week', TRY_CAST(upload_date AS TIMESTAMP))) AS prev_week,
    ROUND((SUM(impressions) - LAG(SUM(impressions)) OVER (
        PARTITION BY workspace ORDER BY DATE_TRUNC('week', TRY_CAST(upload_date AS TIMESTAMP))))
        * 100.0 / NULLIF(LAG(SUM(impressions)) OVER (
        PARTITION BY workspace ORDER BY DATE_TRUNC('week', TRY_CAST(upload_date AS TIMESTAMP))), 0), 2)
    AS wow_pmi
FROM media_dataset
WHERE published_flag = true
GROUP BY workspace, DATE_TRUNC('week', TRY_CAST(upload_date AS TIMESTAMP))
ORDER BY workspace, week
```

---

### 17. Language Performance Index (LPI)
```python
import duckdb, pandas as pd, numpy as np

df = duckdb.sql("""
    SELECT language,
           AVG(total_watch_time_hours) AS avg_watch_hours,
           SUM(subscribers_gained) * 1000.0 / NULLIF(SUM(impressions), 0) AS sub_efficiency,
           COUNT(*) * 1.0 / (SELECT COUNT(*) FROM media_dataset WHERE published_flag=true) AS vol_share
    FROM media_dataset
    WHERE published_flag=true
    GROUP BY language
""").df()

for col in ['avg_watch_hours', 'sub_efficiency', 'vol_share']:
    df[col + '_norm'] = (df[col] - df[col].min()) / (df[col].max() - df[col].min() + 1e-9)

df['lpi'] = (df['avg_watch_hours_norm'] + df['sub_efficiency_norm']) / 2 - df['vol_share_norm']
# Positive LPI = underrepresented but high-performing language
```

---

### 18. Metadata Completeness Index (MCI)
```sql
SELECT
    workspace,
    ROUND(AVG(CASE WHEN headline IS NOT NULL AND headline != '' THEN 1.0 ELSE 0 END) * 100, 2)    AS headline_pct,
    ROUND(AVG(CASE WHEN team_name IS NOT NULL AND team_name != '' THEN 1.0 ELSE 0 END) * 100, 2)  AS team_pct,
    ROUND(AVG(CASE WHEN language IS NOT NULL AND language != '' THEN 1.0 ELSE 0 END) * 100, 2)    AS language_pct,
    ROUND(AVG(CASE WHEN input_type IS NOT NULL AND input_type != '' THEN 1.0 ELSE 0 END) * 100, 2) AS input_type_pct,
    ROUND(AVG(
        (CASE WHEN headline != '' THEN 1 ELSE 0 END +
         CASE WHEN team_name != '' THEN 1 ELSE 0 END +
         CASE WHEN language != '' THEN 1 ELSE 0 END +
         CASE WHEN input_type != '' THEN 1 ELSE 0 END) / 4.0
    ) * 100, 2) AS overall_mci_pct
FROM media_dataset
WHERE published_flag = true
GROUP BY workspace
```

---

### 19. Duplicate Detection Rate (DCDR)
```sql
SELECT
    COUNT(*) AS total_records,
    SUM(dup_flag) AS duplicate_count,
    ROUND(SUM(dup_flag) * 100.0 / COUNT(*), 2) AS dcdr_pct
FROM (
    SELECT
        video_id,
        COUNT(*) OVER (PARTITION BY headline, DATE_TRUNC('day', TRY_CAST(upload_date AS TIMESTAMP))) AS occurrence_count,
        CASE WHEN COUNT(*) OVER (PARTITION BY headline, DATE_TRUNC('day', TRY_CAST(upload_date AS TIMESTAMP))) > 1
             THEN 1 ELSE 0 END AS dup_flag
    FROM media_dataset
) sub
```

---

## Coverage vs PS Scoring Criteria

| PS Criteria | Weight | KPIs Covering It |
|-------------|--------|------------------|
| Business understanding & KPI design | 20 | All 19 — breadth across operational + performance + quality |
| Analytical depth + NL query | 20 | CPDG, ZSP, LPI, HTHR, TSQI, AGV, PMI — trend + multi-dim |
| Data quality checks | 15 | MCI, DCDR, CRM (content ROI signal) |
| Dashboard UX | 20 | All — each KPI maps to a specific dashboard page |
| Scalability | 15 | SQL-first, DuckDB views — add new KPIs without schema change |
| Presentation | 10 | CPDG, HTHR, AGV, LPI are story-worthy insights |
