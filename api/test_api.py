"""
Step 4 API tests — vertical slices, observable behavior through public interface.
Run: uv run pytest api/test_api.py -v
"""
import pytest
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


# ── Slice 1: Health ──────────────────────────────────────────────────────────

def test_health_returns_ok_status():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_health_reports_correct_row_count():
    resp = client.get("/api/health")
    assert resp.json()["db_rows"] == 4569


def test_health_reports_table_count():
    resp = client.get("/api/health")
    assert resp.json()["db_tables"] >= 30  # 9 dim + 16 views + 3 kpi tables + 4 agg + staging


# ── Slice 2: Dimensions ───────────────────────────────────────────────────────

def test_dimensions_returns_all_workspaces():
    resp = client.get("/api/dimensions")
    assert resp.status_code == 200
    ws = resp.json()["workspace"]
    assert "WS-DIGITAL-NEWS" in ws
    assert "WS-SPORTS-LIVE" in ws
    assert len(ws) == 5


def test_dimensions_returns_all_input_types():
    resp = client.get("/api/dimensions")
    it = resp.json()["input_type"]
    assert len(it) == 7
    assert "interview" in it


def test_dimensions_excludes_continuous_date():
    resp = client.get("/api/dimensions")
    assert "date" not in resp.json()


# ── Slice 3: Dashboard Executive ─────────────────────────────────────────────

def test_executive_pcr_total_is_69_point_8():
    resp = client.get("/api/dashboard/executive")
    assert resp.status_code == 200
    pcr = resp.json()["pcr_total"]
    assert 69.0 <= pcr <= 70.5, f"Expected ~69.8 but got {pcr}"


def test_executive_funnel_counts():
    resp = client.get("/api/dashboard/executive")
    funnel = resp.json()["funnel"]
    assert funnel["uploaded"] == 4179
    assert funnel["processed"] == 4179
    assert funnel["published"] == 3188


def test_executive_workspace_pcr_has_5_entries():
    resp = client.get("/api/dashboard/executive")
    ws = resp.json()["workspace_pcr"]
    assert len(ws) == 5


def test_executive_sports_live_has_lowest_pcr():
    resp = client.get("/api/dashboard/executive")
    ws = resp.json()["workspace_pcr"]
    sports = next(w for w in ws if w["workspace"] == "WS-SPORTS-LIVE")
    assert sports["pcr"] < 50, f"Expected PCR<50 for WS-SPORTS-LIVE, got {sports['pcr']}"


def test_executive_trend_returns_list():
    resp = client.get("/api/dashboard/executive")
    trend = resp.json()["trend"]
    assert isinstance(trend, list)


def test_executive_workspace_filter():
    resp = client.get("/api/dashboard/executive?workspace=WS-DIGITAL-NEWS")
    assert resp.status_code == 200
    ws = resp.json()["workspace_pcr"]
    assert len(ws) == 1
    assert ws[0]["workspace"] == "WS-DIGITAL-NEWS"


# ── Slice 4: Publish Funnel ───────────────────────────────────────────────────

def test_publish_funnel_returns_3_stages():
    resp = client.get("/api/dashboard/publish-funnel")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 3
    names = [s["name"] for s in data]
    assert names == ["Uploaded", "Processed", "Published"]


def test_publish_funnel_uploaded_is_100_pct():
    resp = client.get("/api/dashboard/publish-funnel")
    uploaded = resp.json()[0]
    assert uploaded["pct"] == 100.0


# ── Slice 5: KPIs ────────────────────────────────────────────────────────────

def test_kpi_pcr_returns_data():
    resp = client.get("/api/kpis/PCR")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 5  # one row per workspace


def test_kpi_unknown_returns_404():
    resp = client.get("/api/kpis/NOTAKPI")
    assert resp.status_code == 404


def test_kpi_list_returns_19_kpis():
    resp = client.get("/api/kpis")
    assert resp.status_code == 200
    assert len(resp.json()) == 19


# ── Slice 6: Trends ───────────────────────────────────────────────────────────

def test_daily_trends_returns_list():
    resp = client.get("/api/trends/daily")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    if data:
        assert "uploaded" in data[0]
        assert "published_hours" in data[0]


def test_category_trends_returns_7_types():
    resp = client.get("/api/trends/category")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 7


# ── Slice 7: CrossTab ─────────────────────────────────────────────────────────

def test_crosstab_workspace_by_input_type():
    resp = client.get("/api/crosstab?d1=workspace&d2=input_type")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 5  # 5 workspaces
    assert "d1_val" in data[0]


def test_crosstab_rejects_unknown_dimension():
    resp = client.get("/api/crosstab?d1=NOTADIM&d2=input_type")
    assert resp.status_code == 400


def test_crosstab_metric_hours():
    resp = client.get("/api/crosstab?d1=workspace&d2=language&metric=hours")
    assert resp.status_code == 200


# ── Slice 8: Videos ───────────────────────────────────────────────────────────

def test_videos_total_is_4569():
    resp = client.get("/api/videos")
    assert resp.status_code == 200
    assert resp.json()["total"] == 4569


def test_videos_default_page_size():
    resp = client.get("/api/videos")
    data = resp.json()["data"]
    assert len(data) == 20


def test_videos_pagination():
    resp = client.get("/api/videos?page=2&limit=10")
    j = resp.json()
    assert j["page"] == 2
    assert len(j["data"]) == 10


def test_videos_search_filters_results():
    resp = client.get("/api/videos?search=interview")
    total = resp.json()["total"]
    assert total < 4569


def test_videos_workspace_filter():
    resp = client.get("/api/videos?workspace=WS-SPORTS-LIVE&limit=200")
    data = resp.json()["data"]
    for v in data:
        assert v["workspace"] == "WS-SPORTS-LIVE"


def test_videos_export_returns_csv():
    resp = client.get("/api/videos/export")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    lines = resp.text.strip().split("\n")
    assert len(lines) > 100  # header + rows


# ── Slice 9: Admin ────────────────────────────────────────────────────────────

def test_admin_kpis_returns_19():
    resp = client.get("/api/admin/kpis")
    assert resp.status_code == 200
    assert len(resp.json()) == 19


def test_admin_config_has_required_keys():
    resp = client.get("/api/admin/config")
    assert resp.status_code == 200
    cfg = resp.json()
    for key in ("opi_threshold_hours", "pcr_minimum_pct", "enabled_kpis"):
        assert key in cfg, f"Missing key: {key}"


def test_admin_config_update():
    resp = client.put("/api/admin/config", json={"opi_threshold_hours": 72})
    assert resp.status_code == 200
    assert resp.json()["opi_threshold_hours"] == 72
    # reset
    client.put("/api/admin/config", json={"opi_threshold_hours": 48})


# ── Slice 9b: Admin KPI chatbot hardening ────────────────────────────────────

def test_admin_chat_returns_explanation(monkeypatch):
    import api.routers.admin as admin_mod
    monkeypatch.setattr(admin_mod, "llm_chat", lambda *a, **kw: "PCR tracks publish rate.")
    resp = client.post(
        "/api/admin/kpi-chat",
        json={"message": "What KPIs track publish rate?", "history": []},
    )
    assert resp.status_code == 200
    assert "explanation" in resp.json()


def test_admin_chat_error_generic_message(monkeypatch):
    import api.routers.admin as admin_mod
    def _raise(*args, **kwargs):
        raise RuntimeError("internal LLM error with secret details")
    monkeypatch.setattr(admin_mod, "llm_chat", _raise)
    resp = client.post(
        "/api/admin/kpi-chat",
        json={"message": "test", "history": []},
    )
    assert resp.status_code == 500
    assert resp.json()["detail"] == "Chat service temporarily unavailable"
    assert "secret" not in resp.json()["detail"]


# ── Slice 10: NLQ stub ────────────────────────────────────────────────────────

def test_nlq_stub_returns_answer():
    resp = client.post("/api/nlq", json={"question": "Which workspace has lowest PCR?"})
    assert resp.status_code == 200
    assert "answer" in resp.json()


def test_nlq_accepts_page_context():
    resp = client.post("/api/nlq", json={
        "question": "What does this page show?",
        "page_context": {"page": "executive", "filters": {}, "kpis": ["PCR"]},
    })
    assert resp.status_code == 200
    assert "answer" in resp.json()


def test_nlq_stream_post_returns_sse():
    resp = client.post(
        "/api/nlq/stream",
        json={"question": "PCR by workspace", "session_id": "test_post_stream"},
    )
    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers["content-type"]


def test_nlq_rejects_oversized_context():
    # page_context itself is a dict (no max_length), but question has max_length=2000
    resp = client.post("/api/nlq/stream", json={
        "question": "x" * 2001,
        "session_id": "test",
    })
    assert resp.status_code == 422  # validation error


# ── Slice 11: Chronos Forecast ────────────────────────────────────────────────

import pytest

try:
    import torch
    _HAS_TORCH = True
except ImportError:
    _HAS_TORCH = False

_skip_no_torch = pytest.mark.skipif(not _HAS_TORCH, reason="torch not installed (Docker-only)")


@_skip_no_torch
def test_forecast_returns_200():
    resp = client.get("/api/trends/forecast")
    assert resp.status_code == 200


@_skip_no_torch
def test_forecast_has_history_and_forecast_keys():
    resp = client.get("/api/trends/forecast")
    data = resp.json()
    assert "history" in data
    assert "forecast" in data
    assert "model" in data


@_skip_no_torch
def test_forecast_default_horizon_is_30_days():
    resp = client.get("/api/trends/forecast")
    assert len(resp.json()["forecast"]) == 30


@_skip_no_torch
def test_forecast_custom_horizon():
    resp = client.get("/api/trends/forecast?horizon=14")
    assert len(resp.json()["forecast"]) == 14


@_skip_no_torch
def test_forecast_quantiles_are_ordered():
    resp = client.get("/api/trends/forecast")
    for fc in resp.json()["forecast"]:
        assert fc["low"] <= fc["median"], f"low={fc['low']} > median={fc['median']}"
        assert fc["median"] <= fc["high"], f"median={fc['median']} > high={fc['high']}"


@_skip_no_torch
def test_forecast_dates_are_sequential_and_future():
    resp = client.get("/api/trends/forecast")
    data = resp.json()
    last_hist_date = data["history"][-1]["date"]
    first_fc_date = data["forecast"][0]["date"]
    assert first_fc_date > last_hist_date, "Forecast must start after history ends"
    # all forecast dates are unique and ascending
    fc_dates = [fc["date"] for fc in data["forecast"]]
    assert fc_dates == sorted(set(fc_dates))


@_skip_no_torch
def test_forecast_history_has_upload_counts():
    resp = client.get("/api/trends/forecast")
    h = resp.json()["history"]
    assert len(h) > 0
    assert "date" in h[0]
    assert "uploaded" in h[0]
    assert isinstance(h[0]["uploaded"], (int, float))


# ── Insights endpoints ────────────────────────────────────────────────────────

def test_insights_returns_list():
    resp = client.get("/api/insights")
    assert resp.status_code == 200
    data = resp.json()
    assert "insights" in data
    assert isinstance(data["insights"], list)


def test_insights_count_returns_unread():
    resp = client.get("/api/insights/count")
    assert resp.status_code == 200
    data = resp.json()
    assert "unread" in data
    assert isinstance(data["unread"], int)


def test_insights_seeded_on_startup():
    # Ensure seeding runs (idempotent — only seeds if table is empty)
    from api.insights import seed_insights
    seed_insights()
    resp = client.get("/api/insights")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["insights"]) >= 5  # At least 5 seeded insights


def test_insights_filter_by_type():
    resp = client.get("/api/insights?type=alert")
    assert resp.status_code == 200
    data = resp.json()
    for item in data["insights"]:
        assert item["type"] == "alert"


def test_insights_filter_by_severity():
    resp = client.get("/api/insights?severity=warning")
    assert resp.status_code == 200
    data = resp.json()
    for item in data["insights"]:
        assert item["severity"] == "warning"


def test_insights_mark_read():
    # Get first insight
    resp = client.get("/api/insights")
    insights = resp.json()["insights"]
    if insights:
        first_id = insights[0]["id"]
        mark_resp = client.post("/api/insights/mark-read", json={"id": first_id})
        assert mark_resp.status_code == 200
        assert mark_resp.json()["ok"] is True


def test_insights_dismiss():
    # Get insights, dismiss the last one
    resp = client.get("/api/insights")
    insights = resp.json()["insights"]
    if insights:
        last_id = insights[-1]["id"]
        dismiss_resp = client.post(f"/api/insights/dismiss/{last_id}")
        assert dismiss_resp.status_code == 200
        assert dismiss_resp.json()["ok"] is True
        # Verify it's gone from the list
        resp2 = client.get("/api/insights")
        ids = [i["id"] for i in resp2.json()["insights"]]
        assert last_id not in ids


def test_insights_generate():
    resp = client.post("/api/insights/generate")
    assert resp.status_code == 200
    data = resp.json()
    assert "generated" in data
    assert isinstance(data["generated"], int)
