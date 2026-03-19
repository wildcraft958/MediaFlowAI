"""
TDD tests for data/enrich.py
Run from GCAgent/data/: pytest test_enrich.py -v
Note: column names use new neutral identifiers: ai_output_type, workspace.
"""

import pytest
import pandas as pd
import numpy as np
import sys, os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from enrich import (
    assign_input_type,
    assign_ai_output_type,
    compute_processed_date,
    assign_workspace,
    enrich_dataset,
    TEAM_INPUT_WEIGHTS,
    INPUT_OUTPUT_WEIGHTS,
    TEAM_WORKSPACE,
)

VALID_INPUT_TYPES = {t for w in TEAM_INPUT_WEIGHTS.values() for t in w}
VALID_OUTPUT_TYPES = {t for w in INPUT_OUTPUT_WEIGHTS.values() for t in w}


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def sample_df():
    return pd.DataFrame({
        "video_id":              ["VID001", "VID002", "VID003"],
        "headline":              ["Test 1", "Test 2", "Test 3"],
        "source":                ["s1", "s2", "s3"],
        "source_url":            ["u1", "u2", "u3"],
        "published_flag":        ["True", "True", "False"],
        "company":               ["Company_B", "company_A", "company_A"],
        "channel":               ["Youtube", "Instagram", ""],
        "uploaded_by":           ["user1_reacts", "user2_music", "user3_tech_vlog"],
        "team_name":             ["Reacts", "Music", "Tech"],
        "language":              ["Hindi", "English", "English"],
        "input_type":            ["long_videos", "music_videos", "streams"],
        "output_type":           ["shorts", "reels", ""],
        "published_platform":    ["Youtube", "Instagram", ""],
        "published_url":         ["", "", ""],
        "billable_flag":         ["", "", ""],
        "upload_date":           ["2025-01-01 10:00:00", "2025-01-02 12:00:00", "2025-01-03 08:00:00"],
        "video_duration_sec":    [45.0, 30.0, 60.0],
        "avg_view_duration_sec": [25.0, 20.0, None],
        "avg_view_percentage":   [55.0, 66.0, None],
        "subscribers_gained":    [100.0, 200.0, None],
        "traffic_source":        ["Browse", "Search", ""],
        "ctr_percentage":        [5.0, 10.0, None],
        "impressions":           [100000.0, 200000.0, None],
        "likes":                 [1000.0, 2000.0, None],
        "comments":              [50.0, 100.0, None],
        "shares":                [200.0, 400.0, None],
        "total_watch_time_hours":[500.0, 1000.0, None],
    })


# ── assign_input_type ─────────────────────────────────────────────────────────

class TestAssignInputType:
    def test_returns_ps_aligned_input_type(self):
        rng = np.random.default_rng(0)
        result = assign_input_type("Tech", rng)
        assert result in VALID_INPUT_TYPES

    def test_all_teams_return_valid_type(self):
        rng = np.random.default_rng(1)
        for team in TEAM_INPUT_WEIGHTS:
            assert assign_input_type(team, rng) in VALID_INPUT_TYPES

    def test_unknown_team_falls_back_gracefully(self):
        rng = np.random.default_rng(0)
        result = assign_input_type("Unknown_Team", rng)
        assert result in VALID_INPUT_TYPES

    def test_reacts_team_skews_toward_debate(self):
        rng = np.random.default_rng(42)
        results = [assign_input_type("Reacts", rng) for _ in range(1000)]
        assert results.count("debate") / len(results) > 0.20

    def test_tech_team_skews_toward_interview_and_speech(self):
        rng = np.random.default_rng(42)
        results = [assign_input_type("Tech", rng) for _ in range(1000)]
        interview_speech = (results.count("interview") + results.count("speech")) / len(results)
        assert interview_speech > 0.40

    def test_probabilities_sum_to_one_for_every_team(self):
        for team, weights in TEAM_INPUT_WEIGHTS.items():
            total = sum(weights.values())
            assert abs(total - 1.0) < 1e-9, f"{team} weights sum to {total}"


# ── assign_ai_output_type ────────────────────────────────────────────────

class TestAssignAIOutputType:
    def test_returns_valid_output_type(self):
        rng = np.random.default_rng(0)
        result = assign_ai_output_type("interview", rng)
        assert result in VALID_OUTPUT_TYPES

    def test_all_input_types_return_valid_output(self):
        rng = np.random.default_rng(0)
        for input_type in INPUT_OUTPUT_WEIGHTS:
            assert assign_ai_output_type(input_type, rng) in VALID_OUTPUT_TYPES

    def test_speech_produces_more_summaries(self):
        rng = np.random.default_rng(42)
        results = [assign_ai_output_type("speech", rng) for _ in range(1000)]
        assert results.count("summary") / len(results) > 0.25

    def test_interview_produces_more_key_moments(self):
        rng = np.random.default_rng(42)
        results = [assign_ai_output_type("interview", rng) for _ in range(1000)]
        assert results.count("key_moments") / len(results) > 0.35

    def test_special_report_produces_more_chapters(self):
        rng = np.random.default_rng(42)
        results = [assign_ai_output_type("special_report", rng) for _ in range(1000)]
        assert results.count("chapters") / len(results) > 0.20

    def test_probabilities_sum_to_one_for_every_input_type(self):
        for input_type, weights in INPUT_OUTPUT_WEIGHTS.items():
            total = sum(weights.values())
            assert abs(total - 1.0) < 1e-9, f"{input_type} weights sum to {total}"


# ── compute_processed_date ────────────────────────────────────────────────────

class TestComputeProcessedDate:
    def test_processed_date_is_after_upload_date(self):
        rng = np.random.default_rng(0)
        upload = pd.Timestamp("2025-01-01 10:00:00")
        processed = compute_processed_date(upload, rng)
        assert processed > upload

    def test_processed_date_within_72_hour_cap(self):
        rng = np.random.default_rng(42)
        upload = pd.Timestamp("2025-01-01 10:00:00")
        for _ in range(200):
            processed = compute_processed_date(upload, rng)
            delta_hours = (processed - upload).total_seconds() / 3600
            assert 0 < delta_hours <= 72.0

    def test_majority_processed_within_24_hours(self):
        rng = np.random.default_rng(42)
        upload = pd.Timestamp("2025-01-01 10:00:00")
        within_24 = sum(
            1 for _ in range(1000)
            if (compute_processed_date(upload, rng) - upload).total_seconds() / 3600 <= 24
        )
        assert within_24 / 1000 > 0.65

    def test_returns_pandas_timestamp(self):
        rng = np.random.default_rng(0)
        upload = pd.Timestamp("2025-06-15 08:00:00")
        result = compute_processed_date(upload, rng)
        assert isinstance(result, pd.Timestamp)


# ── assign_workspace ──────────────────────────────────────────────────

class TestAssignWorkspace:
    def test_company_b_reacts_returns_correct_workspace(self):
        assert assign_workspace("Company_B", "Reacts") == "WS-DIGITAL-NEWS"

    def test_company_a_music_returns_correct_workspace(self):
        assert assign_workspace("company_A", "Music") == "WS-ENTERTAINMENT"

    def test_all_defined_pairs_return_ws_prefixed_string(self):
        for (company, team), ws in TEAM_WORKSPACE.items():
            result = assign_workspace(company, team)
            assert result.startswith("WS-")

    def test_unknown_combination_returns_fallback_ws_string(self):
        result = assign_workspace("company_X", "NewTeam")
        assert result.startswith("WS-")


# ── enrich_dataset ────────────────────────────────────────────────────────────

class TestEnrichDataset:
    def test_input_type_overwritten_with_ps_values(self, sample_df):
        result = enrich_dataset(sample_df)
        assert all(v in VALID_INPUT_TYPES for v in result["input_type"])

    def test_ai_output_type_column_added(self, sample_df):
        result = enrich_dataset(sample_df)
        assert "ai_output_type" in result.columns
        assert all(v in VALID_OUTPUT_TYPES for v in result["ai_output_type"])

    def test_processed_date_column_added(self, sample_df):
        result = enrich_dataset(sample_df)
        assert "processed_date" in result.columns

    def test_processed_date_always_after_upload_date(self, sample_df):
        result = enrich_dataset(sample_df)
        upload = pd.to_datetime(result["upload_date"])
        processed = pd.to_datetime(result["processed_date"])
        assert all(processed >= upload)

    def test_workspace_column_added(self, sample_df):
        result = enrich_dataset(sample_df)
        assert "workspace" in result.columns
        assert all(v.startswith("WS-") for v in result["workspace"])

    def test_old_channel_column_dropped(self, sample_df):
        result = enrich_dataset(sample_df)
        assert "channel" not in result.columns

    def test_row_count_preserved(self, sample_df):
        result = enrich_dataset(sample_df)
        assert len(result) == len(sample_df)

    def test_performance_metrics_unchanged(self, sample_df):
        result = enrich_dataset(sample_df)
        pd.testing.assert_series_equal(result["likes"], sample_df["likes"])
        pd.testing.assert_series_equal(result["ctr_percentage"], sample_df["ctr_percentage"])
        pd.testing.assert_series_equal(result["total_watch_time_hours"], sample_df["total_watch_time_hours"])

    def test_video_ids_unchanged(self, sample_df):
        result = enrich_dataset(sample_df)
        assert list(result["video_id"]) == list(sample_df["video_id"])

    def test_reproducible_with_same_seed(self, sample_df):
        r1 = enrich_dataset(sample_df, seed=42)
        r2 = enrich_dataset(sample_df, seed=42)
        assert list(r1["input_type"]) == list(r2["input_type"])
        assert list(r1["ai_output_type"]) == list(r2["ai_output_type"])
        assert list(r1["processed_date"]) == list(r2["processed_date"])

    def test_different_seeds_produce_different_assignments(self, sample_df):
        # Use a large enough df so collision probability is negligible
        big_df = pd.concat([sample_df] * 20, ignore_index=True)
        r1 = enrich_dataset(big_df, seed=42)
        r2 = enrich_dataset(big_df, seed=99)
        assert list(r1["input_type"]) != list(r2["input_type"])

    def test_output_has_expected_new_columns(self, sample_df):
        result = enrich_dataset(sample_df)
        for col in ["ai_output_type", "processed_date", "workspace"]:
            assert col in result.columns, f"Missing column: {col}"
