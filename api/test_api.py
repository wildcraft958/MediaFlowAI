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


# ── Slice 10: NLQ stub ────────────────────────────────────────────────────────

def test_nlq_stub_returns_answer():
    resp = client.post("/api/nlq", json={"question": "Which workspace has lowest PCR?"})
    assert resp.status_code == 200
    assert "answer" in resp.json()
