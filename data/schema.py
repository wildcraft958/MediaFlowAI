"""
Step 3 — DuckDB Star Schema + KPI Views
Run from project root: python data/schema.py
Output: frammer.duckdb
"""

import duckdb
import pandas as pd
import numpy as np

DB_PATH = "frammer.duckdb"
CSV_PATH = "data/frammer_dataset.csv"


def create_db():
    con = duckdb.connect(DB_PATH)
    load_staging(con)
    create_dimensions(con)
    create_fact(con)
    create_kpi_views(con)
    compute_python_kpis(con)
    create_agg_tables(con)
    validate(con)
    con.close()


# ---------------------------------------------------------------------------
# 1. Staging
# ---------------------------------------------------------------------------

def load_staging(con):
    con.execute(f"""
        CREATE OR REPLACE TABLE frammer_dataset AS
        SELECT * FROM read_csv_auto('{CSV_PATH}', header=true, nullstr='')
    """)
    count = con.execute("SELECT COUNT(*) FROM frammer_dataset").fetchone()[0]
    print(f"✓ Loaded {count} rows into frammer_dataset")


# ---------------------------------------------------------------------------
# 2. Dimension Tables
# ---------------------------------------------------------------------------

def create_dimensions(con):
    con.execute("""
        CREATE OR REPLACE TABLE dim_workspace AS
        SELECT DISTINCT frammer_workspace, company
        FROM frammer_dataset
        WHERE frammer_workspace IS NOT NULL
    """)

    con.execute("""
        CREATE OR REPLACE TABLE dim_user AS
        SELECT DISTINCT uploaded_by
        FROM frammer_dataset
        WHERE uploaded_by IS NOT NULL
    """)

    con.execute("""
        CREATE OR REPLACE TABLE dim_team AS
        SELECT DISTINCT team_name
        FROM frammer_dataset
        WHERE team_name IS NOT NULL
    """)

    con.execute("""
        CREATE OR REPLACE TABLE dim_language AS
        SELECT DISTINCT language
        FROM frammer_dataset
        WHERE language IS NOT NULL
    """)

    con.execute("""
        CREATE OR REPLACE TABLE dim_input_type AS
        SELECT DISTINCT input_type
        FROM frammer_dataset
        WHERE input_type IS NOT NULL
    """)

    con.execute("""
        CREATE OR REPLACE TABLE dim_output_type AS
        SELECT DISTINCT output_type
        FROM frammer_dataset
        WHERE output_type IS NOT NULL
    """)

    con.execute("""
        CREATE OR REPLACE TABLE dim_frammer_output_type AS
        SELECT DISTINCT frammer_output_type
        FROM frammer_dataset
        WHERE frammer_output_type IS NOT NULL
    """)

    con.execute("""
        CREATE OR REPLACE TABLE dim_platform AS
        SELECT DISTINCT published_platform
        FROM frammer_dataset
        WHERE published_platform IS NOT NULL
    """)

    con.execute("""
        CREATE OR REPLACE TABLE dim_date AS
        SELECT
            date_val,
            EXTRACT(YEAR  FROM date_val) AS year,
            EXTRACT(MONTH FROM date_val) AS month,
            EXTRACT(WEEK  FROM date_val) AS week,
            EXTRACT(QUARTER FROM date_val) AS quarter,
            EXTRACT(DOW   FROM date_val) AS day_of_week
        FROM (
            SELECT DISTINCT CAST(TRY_CAST(upload_date AS TIMESTAMP) AS DATE) AS date_val
            FROM frammer_dataset
            WHERE TRY_CAST(upload_date AS TIMESTAMP) IS NOT NULL
        ) t
    """)

    print("✓ Created 9 dimension tables")


# ---------------------------------------------------------------------------
# 3. Fact View
# ---------------------------------------------------------------------------

def create_fact(con):
    con.execute("""
        CREATE OR REPLACE VIEW fact_video_events AS
        SELECT
            video_id,
            headline,
            source,
            published_flag,
            billable_flag,
            TRY_CAST(upload_date    AS TIMESTAMP) AS uploaded_at,
            TRY_CAST(processed_date AS TIMESTAMP) AS processed_at,
            video_duration_sec,
            avg_view_duration_sec,
            avg_view_percentage,
            subscribers_gained,
            ctr_percentage,
            CAST(impressions AS DOUBLE)           AS impressions,
            likes,
            comments,
            shares,
            total_watch_time_hours,
            traffic_source,
            published_url,
            frammer_workspace,
            uploaded_by,
            team_name,
            language,
            input_type,
            output_type,
            frammer_output_type,
            published_platform
        FROM frammer_dataset
    """)
    print("✓ Created fact_video_events view")


# ---------------------------------------------------------------------------
# 4. SQL KPI Views
# ---------------------------------------------------------------------------

def create_kpi_views(con):

    # PCR — Publish Conversion Rate
    con.execute("""
        CREATE OR REPLACE VIEW v_pcr AS
        SELECT
            frammer_workspace,
            COUNT(*) AS total_uploaded,
            SUM(CASE WHEN published_flag = true THEN 1 ELSE 0 END) AS total_published,
            ROUND(SUM(CASE WHEN published_flag = true THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS pcr_pct
        FROM frammer_dataset
        GROUP BY frammer_workspace
    """)

    # FSC — Funnel Stage Conversion
    con.execute("""
        CREATE OR REPLACE VIEW v_fsc AS
        SELECT
            frammer_workspace,
            COUNT(*) AS uploaded,
            COUNT(processed_date) AS processed,
            SUM(CASE WHEN published_flag = true THEN 1 ELSE 0 END) AS published,
            ROUND(COUNT(processed_date) * 100.0 / COUNT(*), 2) AS upload_to_process_pct,
            ROUND(SUM(CASE WHEN published_flag = true THEN 1 ELSE 0 END) * 100.0
                  / NULLIF(COUNT(processed_date), 0), 2) AS process_to_publish_pct
        FROM frammer_dataset
        GROUP BY frammer_workspace
    """)

    # GR — MoM Growth Rate
    con.execute("""
        CREATE OR REPLACE VIEW v_gr AS
        SELECT
            DATE_TRUNC('month', TRY_CAST(upload_date AS TIMESTAMP)) AS month,
            COUNT(*) AS uploads,
            LAG(COUNT(*)) OVER (ORDER BY DATE_TRUNC('month', TRY_CAST(upload_date AS TIMESTAMP))) AS prev_month,
            ROUND(
                (COUNT(*) - LAG(COUNT(*)) OVER (ORDER BY DATE_TRUNC('month', TRY_CAST(upload_date AS TIMESTAMP))))
                * 100.0 / NULLIF(LAG(COUNT(*)) OVER (
                    ORDER BY DATE_TRUNC('month', TRY_CAST(upload_date AS TIMESTAMP))), 0),
            2) AS mom_growth_pct
        FROM frammer_dataset
        WHERE TRY_CAST(upload_date AS TIMESTAMP) IS NOT NULL
        GROUP BY 1
        ORDER BY 1
    """)

    # OPI — Orphaned Processing Index
    con.execute("""
        CREATE OR REPLACE VIEW v_opi AS
        SELECT
            frammer_workspace,
            team_name,
            input_type,
            COUNT(*) AS orphaned_count,
            ROUND(SUM(video_duration_sec / 3600.0), 2) AS orphaned_hours
        FROM frammer_dataset
        WHERE published_flag = false
          AND TRY_CAST(upload_date AS TIMESTAMP) IS NOT NULL
          AND TRY_CAST(upload_date AS TIMESTAMP) < NOW() - INTERVAL '30 days'
        GROUP BY frammer_workspace, team_name, input_type
        ORDER BY orphaned_hours DESC
    """)

    # TEU — Time Efficiency of User
    con.execute("""
        CREATE OR REPLACE VIEW v_teu AS
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
                    - LAG(TRY_CAST(upload_date AS TIMESTAMP)) OVER (
                        PARTITION BY uploaded_by ORDER BY TRY_CAST(upload_date AS TIMESTAMP)
                    )
                )) / 3600.0 AS gap_hours
            FROM frammer_dataset
            WHERE TRY_CAST(upload_date AS TIMESTAMP) IS NOT NULL
        ) sub
        WHERE gap_hours IS NOT NULL
        GROUP BY uploaded_by, team_name
    """)

    # AIL — AI Output Leverage
    con.execute("""
        CREATE OR REPLACE VIEW v_ail AS
        SELECT
            frammer_workspace,
            frammer_output_type,
            ROUND(SUM(CAST(impressions AS DOUBLE)) / NULLIF(SUM(video_duration_sec / 3600.0), 0), 2)
                AS impressions_per_source_hour
        FROM frammer_dataset
        WHERE published_flag = true
        GROUP BY frammer_workspace, frammer_output_type
        ORDER BY impressions_per_source_hour DESC
    """)

    # SAC — Subscriber Attention Cost
    con.execute("""
        CREATE OR REPLACE VIEW v_sac AS
        SELECT
            frammer_workspace,
            input_type,
            ROUND(SUM(total_watch_time_hours) * 60.0 / NULLIF(SUM(subscribers_gained), 0), 2)
                AS minutes_per_subscriber
        FROM frammer_dataset
        WHERE published_flag = true
        GROUP BY frammer_workspace, input_type
        ORDER BY minutes_per_subscriber ASC
    """)

    # AHY — Attention Harvest Yield
    con.execute("""
        CREATE OR REPLACE VIEW v_ahy AS
        SELECT
            frammer_workspace,
            frammer_output_type,
            ROUND(SUM(total_watch_time_hours) / NULLIF(SUM(video_duration_sec), 0), 6)
                AS watch_hours_per_source_second
        FROM frammer_dataset
        WHERE published_flag = true
        GROUP BY frammer_workspace, frammer_output_type
    """)

    # EDR — Engagement Depth Rate
    con.execute("""
        CREATE OR REPLACE VIEW v_edr AS
        SELECT
            frammer_workspace,
            input_type,
            ROUND(SUM(likes + comments + shares) * 100.0 / NULLIF(SUM(CAST(impressions AS DOUBLE)), 0), 4)
                AS edr_pct
        FROM frammer_dataset
        WHERE published_flag = true
        GROUP BY frammer_workspace, input_type
        ORDER BY edr_pct DESC
    """)

    # HTHR — Hook-to-Hold Resonance Score
    con.execute("""
        CREATE OR REPLACE VIEW v_hthr AS
        SELECT
            video_id,
            headline,
            input_type,
            frammer_workspace,
            ROUND(ctr_percentage * avg_view_percentage * LOG10(CAST(impressions AS DOUBLE)), 4)
                AS hthr_score
        FROM frammer_dataset
        WHERE published_flag = true
          AND CAST(impressions AS DOUBLE) > 0
        ORDER BY hthr_score DESC
    """)

    # TSQI — Traffic Source Quality Index
    con.execute("""
        CREATE OR REPLACE VIEW v_tsqi AS
        SELECT
            traffic_source,
            COUNT(*) AS video_count,
            ROUND(AVG(total_watch_time_hours), 2) AS avg_watch_hours,
            ROUND(AVG(avg_view_percentage), 2) AS avg_retention_pct,
            ROUND(AVG(subscribers_gained), 2) AS avg_subscribers
        FROM frammer_dataset
        WHERE published_flag = true
          AND traffic_source IS NOT NULL AND traffic_source != ''
        GROUP BY traffic_source
        ORDER BY avg_watch_hours DESC
    """)

    # PIG — Platform Impression Gap
    con.execute("""
        CREATE OR REPLACE VIEW v_pig AS
        SELECT
            published_platform,
            COUNT(*) AS video_count,
            ROUND(AVG(CAST(impressions AS DOUBLE)), 0) AS avg_impressions,
            ROUND(AVG(ctr_percentage), 2) AS avg_ctr,
            ROUND(AVG(avg_view_percentage), 2) AS avg_retention
        FROM frammer_dataset
        WHERE published_flag = true
          AND published_platform IS NOT NULL AND published_platform != ''
        GROUP BY published_platform
    """)

    # AGV — Audience Growth Velocity
    con.execute("""
        CREATE OR REPLACE VIEW v_agv AS
        SELECT
            company,
            DATE_TRUNC('month', TRY_CAST(upload_date AS TIMESTAMP)) AS month,
            SUM(subscribers_gained) AS monthly_subscribers,
            LAG(SUM(subscribers_gained)) OVER (
                PARTITION BY company
                ORDER BY DATE_TRUNC('month', TRY_CAST(upload_date AS TIMESTAMP))
            ) AS prev_month_subs,
            ROUND(
                (SUM(subscribers_gained) - LAG(SUM(subscribers_gained)) OVER (
                    PARTITION BY company
                    ORDER BY DATE_TRUNC('month', TRY_CAST(upload_date AS TIMESTAMP))
                )) * 100.0 / NULLIF(LAG(SUM(subscribers_gained)) OVER (
                    PARTITION BY company
                    ORDER BY DATE_TRUNC('month', TRY_CAST(upload_date AS TIMESTAMP))
                ), 0),
            2) AS mom_growth_pct
        FROM frammer_dataset
        WHERE TRY_CAST(upload_date AS TIMESTAMP) IS NOT NULL
        GROUP BY company, DATE_TRUNC('month', TRY_CAST(upload_date AS TIMESTAMP))
        ORDER BY company, month
    """)

    # PMI — Performance Momentum Index
    con.execute("""
        CREATE OR REPLACE VIEW v_pmi AS
        SELECT
            frammer_workspace,
            DATE_TRUNC('week', TRY_CAST(upload_date AS TIMESTAMP)) AS week,
            SUM(CAST(impressions AS DOUBLE)) AS weekly_impressions,
            LAG(SUM(CAST(impressions AS DOUBLE))) OVER (
                PARTITION BY frammer_workspace
                ORDER BY DATE_TRUNC('week', TRY_CAST(upload_date AS TIMESTAMP))
            ) AS prev_week,
            ROUND(
                (SUM(CAST(impressions AS DOUBLE)) - LAG(SUM(CAST(impressions AS DOUBLE))) OVER (
                    PARTITION BY frammer_workspace
                    ORDER BY DATE_TRUNC('week', TRY_CAST(upload_date AS TIMESTAMP))
                )) * 100.0 / NULLIF(LAG(SUM(CAST(impressions AS DOUBLE))) OVER (
                    PARTITION BY frammer_workspace
                    ORDER BY DATE_TRUNC('week', TRY_CAST(upload_date AS TIMESTAMP))
                ), 0),
            2) AS wow_pmi
        FROM frammer_dataset
        WHERE published_flag = true
          AND TRY_CAST(upload_date AS TIMESTAMP) IS NOT NULL
        GROUP BY frammer_workspace, DATE_TRUNC('week', TRY_CAST(upload_date AS TIMESTAMP))
        ORDER BY frammer_workspace, week
    """)

    # MCI — Metadata Completeness Index
    con.execute("""
        CREATE OR REPLACE VIEW v_mci AS
        SELECT
            frammer_workspace,
            ROUND(AVG(CASE WHEN headline  IS NOT NULL AND headline  != '' THEN 1.0 ELSE 0 END) * 100, 2) AS headline_pct,
            ROUND(AVG(CASE WHEN team_name IS NOT NULL AND team_name != '' THEN 1.0 ELSE 0 END) * 100, 2) AS team_pct,
            ROUND(AVG(CASE WHEN language  IS NOT NULL AND language  != '' THEN 1.0 ELSE 0 END) * 100, 2) AS language_pct,
            ROUND(AVG(CASE WHEN input_type IS NOT NULL AND input_type != '' THEN 1.0 ELSE 0 END) * 100, 2) AS input_type_pct,
            ROUND(AVG(
                (CASE WHEN headline  != '' THEN 1 ELSE 0 END +
                 CASE WHEN team_name != '' THEN 1 ELSE 0 END +
                 CASE WHEN language  != '' THEN 1 ELSE 0 END +
                 CASE WHEN input_type != '' THEN 1 ELSE 0 END) / 4.0
            ) * 100, 2) AS overall_mci_pct
        FROM frammer_dataset
        WHERE published_flag = true
        GROUP BY frammer_workspace
    """)

    # DCDR — Duplicate Detection Rate
    con.execute("""
        CREATE OR REPLACE VIEW v_dcdr AS
        SELECT
            COUNT(*) AS total_records,
            SUM(dup_flag) AS duplicate_count,
            ROUND(SUM(dup_flag) * 100.0 / COUNT(*), 2) AS dcdr_pct
        FROM (
            SELECT
                video_id,
                CASE WHEN COUNT(*) OVER (
                    PARTITION BY headline,
                    DATE_TRUNC('day', TRY_CAST(upload_date AS TIMESTAMP))
                ) > 1 THEN 1 ELSE 0 END AS dup_flag
            FROM frammer_dataset
            WHERE TRY_CAST(upload_date AS TIMESTAMP) IS NOT NULL
        ) sub
    """)

    print("✓ Created 16 KPI views")


# ---------------------------------------------------------------------------
# 5. Python KPI Tables
# ---------------------------------------------------------------------------

def compute_python_kpis(con):
    # CPDG — Content Promise vs Delivery Gap
    df = con.sql("""
        SELECT video_id, ctr_percentage, avg_view_percentage
        FROM frammer_dataset
        WHERE published_flag = true
    """).df().dropna(subset=['ctr_percentage', 'avg_view_percentage'])

    df['z_ctr'] = (df['ctr_percentage'] - df['ctr_percentage'].mean()) / df['ctr_percentage'].std()
    df['z_avp'] = (df['avg_view_percentage'] - df['avg_view_percentage'].mean()) / df['avg_view_percentage'].std()
    df['cpdg_raw'] = df['z_ctr'] - df['z_avp']
    df['cpdg'] = (df['cpdg_raw'] - df['cpdg_raw'].min()) / (df['cpdg_raw'].max() - df['cpdg_raw'].min())
    con.register('cpdg_df', df[['video_id', 'cpdg']])
    con.execute("CREATE OR REPLACE TABLE kpi_cpdg AS SELECT * FROM cpdg_df")

    # ZSP — Z-Score Performance (per company)
    df2 = con.sql("""
        SELECT video_id, headline, company, CAST(impressions AS DOUBLE) AS impressions
        FROM frammer_dataset
        WHERE published_flag = true
    """).df().dropna(subset=['impressions'])

    df2['zsp'] = df2.groupby('company')['impressions'].transform(
        lambda x: (x - x.mean()) / x.std()
    )
    con.register('zsp_df', df2[['video_id', 'headline', 'company', 'impressions', 'zsp']])
    con.execute("CREATE OR REPLACE TABLE kpi_zsp AS SELECT * FROM zsp_df")

    # LPI — Language Performance Index
    df3 = con.sql("""
        SELECT
            language,
            AVG(total_watch_time_hours) AS avg_watch_hours,
            SUM(subscribers_gained) * 1000.0 / NULLIF(SUM(CAST(impressions AS DOUBLE)), 0) AS sub_efficiency,
            COUNT(*) * 1.0 / (SELECT COUNT(*) FROM frammer_dataset WHERE published_flag = true) AS vol_share
        FROM frammer_dataset
        WHERE published_flag = true
        GROUP BY language
    """).df()

    for col in ['avg_watch_hours', 'sub_efficiency', 'vol_share']:
        col_min = df3[col].min()
        col_max = df3[col].max()
        df3[col + '_norm'] = (df3[col] - col_min) / (col_max - col_min + 1e-9)

    df3['lpi'] = (df3['avg_watch_hours_norm'] + df3['sub_efficiency_norm']) / 2 - df3['vol_share_norm']
    con.register('lpi_df', df3[['language', 'avg_watch_hours', 'sub_efficiency', 'vol_share', 'lpi']])
    con.execute("CREATE OR REPLACE TABLE kpi_lpi AS SELECT * FROM lpi_df")

    cpdg_n = con.execute("SELECT COUNT(*) FROM kpi_cpdg").fetchone()[0]
    zsp_n  = con.execute("SELECT COUNT(*) FROM kpi_zsp").fetchone()[0]
    lpi_n  = con.execute("SELECT COUNT(*) FROM kpi_lpi").fetchone()[0]
    print(f"✓ Computed 3 Python KPI tables (cpdg: {cpdg_n} rows, zsp: {zsp_n} rows, lpi: {lpi_n} rows)")


# ---------------------------------------------------------------------------
# 6. Pre-aggregated Tables
# ---------------------------------------------------------------------------

def create_agg_tables(con):
    con.execute("""
        CREATE OR REPLACE TABLE agg_daily_summary AS
        SELECT
            TRY_CAST(upload_date AS DATE) AS upload_day,
            frammer_workspace,
            COUNT(*) AS uploaded_count,
            ROUND(SUM(video_duration_sec / 3600.0), 4) AS uploaded_hours,
            COUNT(processed_date) AS processed_count,
            SUM(CASE WHEN published_flag = true THEN 1 ELSE 0 END) AS published_count,
            ROUND(SUM(CASE WHEN published_flag = true THEN video_duration_sec / 3600.0 ELSE 0 END), 4)
                AS published_hours
        FROM frammer_dataset
        WHERE TRY_CAST(upload_date AS TIMESTAMP) IS NOT NULL
        GROUP BY 1, 2
    """)

    con.execute("""
        CREATE OR REPLACE TABLE agg_channel_funnel AS
        SELECT
            frammer_workspace,
            company,
            COUNT(*) AS total_uploaded,
            COUNT(processed_date) AS total_processed,
            SUM(CASE WHEN published_flag = true THEN 1 ELSE 0 END) AS total_published,
            ROUND(COUNT(processed_date) * 100.0 / COUNT(*), 2) AS upload_to_process_pct,
            ROUND(SUM(CASE WHEN published_flag = true THEN 1 ELSE 0 END) * 100.0
                  / NULLIF(COUNT(processed_date), 0), 2) AS process_to_publish_pct,
            ROUND(SUM(CASE WHEN published_flag = true THEN 1 ELSE 0 END) * 100.0
                  / COUNT(*), 2) AS overall_pcr_pct
        FROM frammer_dataset
        GROUP BY frammer_workspace, company
    """)

    con.execute("""
        CREATE OR REPLACE TABLE agg_output_type_summary AS
        SELECT
            frammer_output_type,
            DATE_TRUNC('month', TRY_CAST(upload_date AS TIMESTAMP)) AS month,
            COUNT(*) AS video_count,
            ROUND(SUM(CAST(impressions AS DOUBLE)), 0) AS total_impressions,
            ROUND(AVG(total_watch_time_hours), 4) AS avg_watch_hours,
            SUM(CASE WHEN published_flag = true THEN 1 ELSE 0 END) AS published_count
        FROM frammer_dataset
        WHERE TRY_CAST(upload_date AS TIMESTAMP) IS NOT NULL
        GROUP BY frammer_output_type, DATE_TRUNC('month', TRY_CAST(upload_date AS TIMESTAMP))
        ORDER BY frammer_output_type, month
    """)

    con.execute("""
        CREATE OR REPLACE TABLE agg_user_activity AS
        SELECT
            uploaded_by,
            team_name,
            DATE_TRUNC('week', TRY_CAST(upload_date AS TIMESTAMP)) AS week,
            COUNT(*) AS uploads,
            ROUND(SUM(video_duration_sec / 3600.0), 4) AS upload_hours,
            SUM(CASE WHEN published_flag = true THEN 1 ELSE 0 END) AS published_count
        FROM frammer_dataset
        WHERE TRY_CAST(upload_date AS TIMESTAMP) IS NOT NULL
        GROUP BY uploaded_by, team_name, DATE_TRUNC('week', TRY_CAST(upload_date AS TIMESTAMP))
        ORDER BY uploaded_by, week
    """)

    print("✓ Created 4 agg_* tables")


# ---------------------------------------------------------------------------
# 7. Validate
# ---------------------------------------------------------------------------

def validate(con):
    print("\nKPI spot checks:")
    print("  v_pcr:")
    con.sql("SELECT frammer_workspace, pcr_pct FROM v_pcr").show()
    print("  v_fsc:")
    con.sql("SELECT frammer_workspace, upload_to_process_pct, process_to_publish_pct FROM v_fsc").show()
    print("  kpi_zsp rows:", con.execute("SELECT COUNT(*) FROM kpi_zsp").fetchone()[0])
    print("  kpi_cpdg rows:", con.execute("SELECT COUNT(*) FROM kpi_cpdg").fetchone()[0])
    print("\nAll tables:")
    con.sql("SHOW TABLES").show()


if __name__ == "__main__":
    create_db()
