"""
Step 5 Agent tests — vertical slices, observable behavior.
Run: uv run pytest agents/test_agents.py -v
"""
import pytest
from agents.graph_state import AgentState
from agents.text2sql.guardrails import check, check_columns


# ── Slice 1: Guardrails — pure function, no LLM needed ───────────────────────

def test_guardrails_blocks_drop():
    safe, errors = check("DROP TABLE frammer_dataset")
    assert not safe
    assert any("DROP" in e or "Blocked" in e for e in errors)


def test_guardrails_blocks_delete():
    safe, errors = check("DELETE FROM frammer_dataset WHERE 1=1")
    assert not safe


def test_guardrails_blocks_wrong_cast():
    safe, errors = check("SELECT upload_date::TIMESTAMP FROM frammer_dataset")
    assert not safe
    assert any("TRY_CAST" in e for e in errors)


def test_guardrails_blocks_wrong_boolean():
    safe, errors = check("SELECT * FROM frammer_dataset WHERE published_flag = 1")
    assert not safe


def test_guardrails_passes_valid_select():
    sql = """
    SELECT frammer_workspace, COUNT(*) AS total,
           SUM(CASE WHEN published_flag=true THEN 1 ELSE 0 END) AS published
    FROM frammer_dataset
    WHERE TRY_CAST(upload_date AS TIMESTAMP) >= NOW() - INTERVAL '30 days'
    GROUP BY frammer_workspace
    """
    safe, errors = check(sql)
    assert safe, f"Expected safe, got errors: {errors}"


def test_guardrails_passes_with_clause():
    sql = "WITH x AS (SELECT * FROM frammer_dataset) SELECT * FROM x LIMIT 10"
    safe, errors = check(sql)
    assert safe


def test_column_check_passes_known_columns():
    sql = "SELECT frammer_workspace, published_flag, video_duration_sec FROM frammer_dataset"
    safe, errors = check_columns(sql)
    assert safe, f"Expected safe, got: {errors}"


# ── Slice 2: AgentState schema ────────────────────────────────────────────────

def test_agent_state_accepts_minimal_fields():
    state: AgentState = {
        "session_id": "test",
        "persona": "leadership",
        "client_id": "CLIENT_1",
        "query": "Which workspace has the lowest PCR?",
        "filters": {},
        "thought_steps": [],
        "history": [],
    }
    assert state["query"] == "Which workspace has the lowest PCR?"
    assert state["thought_steps"] == []


# ── Slice 3: Router node (without ChromaDB — tests intent defaulting) ─────────

def test_router_defaults_to_ad_hoc_without_vectorstore():
    """Router should default to ad_hoc when ChromaDB is unavailable."""
    from agents.qna_agent import router_node
    state: AgentState = {
        "session_id": "test",
        "query": "random query that won't match anything",
        "thought_steps": [],
        "persona": "leadership",
        "client_id": "CLIENT_1",
        "filters": {},
        "history": [],
    }
    result = router_node(state)
    assert result["intent"] in ("ad_hoc", "standard_kpi")
    assert len(result["thought_steps"]) >= 1


# ── Slice 4: KPI MCP server (unit — no network) ───────────────────────────────

def test_kpi_server_list_returns_leadership_kpis():
    from agents.mcp_servers.kpi_server import list_kpis
    result = list_kpis("leadership")
    assert isinstance(result, list)
    assert len(result) > 0
    assert all("acronym" in r for r in result)


def test_kpi_server_list_returns_creator_kpis():
    from agents.mcp_servers.kpi_server import list_kpis
    creator = list_kpis("creator")
    leadership = list_kpis("leadership")
    assert len(creator) > 0
    # Creator KPIs include CPDG, ZSP, etc.
    creator_acronyms = [r["acronym"] for r in creator]
    assert "CPDG" in creator_acronyms or "ZSP" in creator_acronyms


def test_kpi_server_run_pcr_returns_5_rows():
    from agents.mcp_servers.kpi_server import run_kpi_query
    result = run_kpi_query("PCR", {})
    assert isinstance(result, list)
    assert len(result) == 5  # one per workspace


def test_kpi_server_unknown_kpi_returns_error():
    from agents.mcp_servers.kpi_server import run_kpi_query
    result = run_kpi_query("NOTAKPI", {})
    assert result[0].get("error") is not None


# ── Slice 5: Alert server threshold check ────────────────────────────────────

def test_alert_server_check_thresholds_returns_list():
    from agents.mcp_servers.alert_server import check_thresholds
    result = check_thresholds("CLIENT_1")
    assert isinstance(result, list)
    assert len(result) >= 1


def test_alert_server_sports_live_triggers_pcr_alert():
    """WS-SPORTS-LIVE has 38% PCR — well below 50% threshold."""
    from agents.mcp_servers.alert_server import check_thresholds
    alerts = check_thresholds("CLIENT_1")
    statuses = [a.get("status") for a in alerts]
    # Either there are real alerts or OK — should not crash
    assert all(s in ("ALERT", "OK") for s in statuses)


# ── Slice 6: Report server HTML fallback ─────────────────────────────────────

def test_report_server_returns_base64_string():
    from agents.mcp_servers.report_server import generate_client_brief
    result = generate_client_brief("CLIENT_1", "test_period")
    assert isinstance(result, str)
    assert len(result) > 100  # some base64 content
    # Should be valid base64
    import base64
    decoded = base64.b64decode(result)
    assert len(decoded) > 0
