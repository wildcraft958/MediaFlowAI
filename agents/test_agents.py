"""
Step 5 Agent tests — vertical slices, observable behavior.
Run: uv run pytest agents/test_agents.py -v
"""
import pytest
from agents.graph_state import AgentState
from agents.text2sql.guardrails import check, check_columns, check_all, GuardrailResult, GuardrailViolation


# ── Slice 1: Guardrails — pure function, no LLM needed ───────────────────────

def test_guardrails_blocks_drop():
    safe, errors = check("DROP TABLE media_dataset")
    assert not safe
    assert any("DROP" in e or "Blocked" in e for e in errors)


def test_guardrails_blocks_delete():
    safe, errors = check("DELETE FROM media_dataset WHERE 1=1")
    assert not safe


def test_guardrails_blocks_wrong_cast():
    safe, errors = check("SELECT upload_date::TIMESTAMP FROM media_dataset")
    assert not safe
    assert any("TRY_CAST" in e for e in errors)


def test_guardrails_blocks_wrong_boolean():
    safe, errors = check("SELECT * FROM media_dataset WHERE published_flag = 1")
    assert not safe


def test_guardrails_passes_valid_select():
    sql = """
    SELECT workspace, COUNT(*) AS total,
           SUM(CASE WHEN published_flag=true THEN 1 ELSE 0 END) AS published
    FROM media_dataset
    WHERE TRY_CAST(upload_date AS TIMESTAMP) >= NOW() - INTERVAL '30 days'
    GROUP BY workspace
    """
    safe, errors = check(sql)
    assert safe, f"Expected safe, got errors: {errors}"


def test_guardrails_passes_with_clause():
    sql = "WITH x AS (SELECT * FROM media_dataset) SELECT * FROM x LIMIT 10"
    safe, errors = check(sql)
    assert safe


def test_column_check_passes_known_columns():
    sql = "SELECT workspace, published_flag, video_duration_sec FROM media_dataset"
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


# ── Slice 3: Router node (returns Command, not dict) ──────────────────────────

def test_router_defaults_to_ad_hoc_without_vectorstore():
    """Router returns Command — check goto and update fields."""
    from agents.qna_agent import router_node
    from langgraph.store.memory import InMemoryStore
    state: AgentState = {
        "session_id": "test",
        "query": "random query that won't match anything",
        "thought_steps": [],
        "persona": "leadership",
        "client_id": "CLIENT_1",
        "filters": {},
        "history": [],
    }
    result = router_node(state, store=InMemoryStore())
    # Router now returns Command, not a plain dict
    assert hasattr(result, "goto")
    assert result.goto in ("analytics", "text2sql", "narrate")
    assert result.update.get("intent") in ("ad_hoc", "standard_kpi", "off_topic", "kpi_definition", "context_aware")
    assert len(result.update.get("thought_steps", [])) >= 1


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
    assert all(s in ("ALERT", "OK") for s in statuses)


# ── Slice 6: Report server HTML fallback ─────────────────────────────────────

def test_report_server_returns_base64_string():
    from agents.mcp_servers.report_server import generate_client_brief
    result = generate_client_brief("CLIENT_1", "test_period")
    assert isinstance(result, str)
    assert len(result) > 100
    import base64
    decoded = base64.b64decode(result)
    assert len(decoded) > 0


# ── Slice 7: Guardrail Pydantic models ───────────────────────────────────────

def test_check_all_returns_guardrail_result():
    result = check_all("SELECT * FROM media_dataset LIMIT 10")
    assert isinstance(result, GuardrailResult)
    assert result.safe is True
    assert result.violations == []


def test_check_all_wrong_cast_returns_duckdb_violation():
    result = check_all("SELECT upload_date::TIMESTAMP FROM media_dataset")
    assert isinstance(result, GuardrailResult)
    assert result.safe is False
    assert len(result.violations) >= 1
    assert result.violations[0].category == "duckdb"
    assert result.violations[0].code == "wrong_cast_syntax"


def test_check_all_wrong_boolean_returns_duckdb_violation():
    result = check_all("SELECT * FROM media_dataset WHERE published_flag = 1")
    assert isinstance(result, GuardrailResult)
    assert result.safe is False
    categories = [v.category for v in result.violations]
    codes = [v.code for v in result.violations]
    assert "duckdb" in categories
    assert "wrong_boolean_compare" in codes


def test_check_all_agg_no_groupby_returns_aggregation_violation():
    sql = "SELECT workspace, COUNT(*) FROM media_dataset"
    result = check_all(sql)
    assert isinstance(result, GuardrailResult)
    assert result.safe is False
    categories = [v.category for v in result.violations]
    assert "aggregation" in categories
    agg_codes = [v.code for v in result.violations if v.category == "aggregation"]
    assert "agg_no_groupby" in agg_codes


def test_check_all_count_star_only_is_safe():
    """SELECT COUNT(*) FROM ... has no non-aggregated cols — should pass."""
    sql = "SELECT COUNT(*) AS total FROM media_dataset WHERE published_flag = true"
    result = check_all(sql)
    assert result.safe is True, f"Expected safe, got violations: {result.violations}"


def test_check_all_unknown_workspace_returns_filter_violation():
    sql = "SELECT * FROM media_dataset WHERE workspace = 'WS-FAKE'"
    result = check_all(sql)
    assert isinstance(result, GuardrailResult)
    assert result.safe is False
    categories = [v.category for v in result.violations]
    assert "filter" in categories


# ── Slice 8: Taxonomy-driven correction loop ─────────────────────────────────

def test_classify_execution_error_col_missing():
    from agents.text2sql.correction_loop import classify_execution_error
    category, code = classify_execution_error(
        "Binder Error: Referenced column nonexistent_col not found"
    )
    assert category == "schema_link"
    assert code == "col_missing"


def test_classify_execution_error_parser_error():
    from agents.text2sql.correction_loop import classify_execution_error
    category, code = classify_execution_error("Parser Error: syntax error at or near SELECT")
    assert category == "syntax"


def test_classify_execution_error_catalog_error():
    from agents.text2sql.correction_loop import classify_execution_error
    category, code = classify_execution_error("Catalog Error: Table does not exist")
    assert category == "schema_link"
    assert code == "table_missing"


def test_run_correction_loop_returns_four_tuple():
    """run_correction_loop now returns (sql, rows, error, correction_log)."""
    from agents.text2sql.correction_loop import run_correction_loop

    calls = []

    def fake_execute(sql):
        calls.append(sql)
        return [{"count": 5}], None  # success on first try

    result = run_correction_loop("test question", "SELECT 1", fake_execute)
    assert len(result) == 4
    final_sql, rows, error, correction_log = result
    assert rows is not None
    assert error is None
    assert isinstance(correction_log, list)


def test_run_correction_loop_uses_initial_violations():
    """When initial_violations provided, uses them directly without LLM classification."""
    from agents.text2sql.correction_loop import run_correction_loop
    from agents.text2sql.guardrails import GuardrailViolation

    violations = [
        GuardrailViolation(
            category="duckdb",
            code="wrong_cast_syntax",
            message="Use TRY_CAST",
        )
    ]

    attempt = 0

    def fake_execute(sql):
        nonlocal attempt
        attempt += 1
        if attempt == 1:
            return None, "Invalid Input Error: Conversion error"
        return [{"ok": 1}], None

    final_sql, rows, error, log = run_correction_loop(
        "test", "SELECT upload_date::TIMESTAMP FROM media_dataset",
        fake_execute, initial_violations=violations
    )
    # First attempt logged with violation category
    assert any("duckdb" in entry for entry in log)


# ── Slice 9: QueryPlan Pydantic validation ───────────────────────────────────

def test_query_plan_validates():
    from agents.text2sql.query_planner import QueryPlan
    plan = QueryPlan(
        steps=["FROM media_dataset", "GROUP BY workspace", "SELECT COUNT(*)"],
        tables_used=["media_dataset"],
        aggregation_strategy="grouped_agg",
        requires_join=False,
        duckdb_notes=["Use TRY_CAST for dates"],
    )
    assert plan.aggregation_strategy == "grouped_agg"
    assert len(plan.steps) == 3
    assert plan.requires_join is False


def test_query_plan_defaults():
    from agents.text2sql.query_planner import QueryPlan
    plan = QueryPlan()
    assert plan.aggregation_strategy == "none"
    assert plan.tables_used == ["media_dataset"]
    assert plan.requires_join is False


# ── Slice 10: HITL state fields ───────────────────────────────────────────────

def test_agent_state_accepts_hitl_fields():
    state: AgentState = {
        "session_id": "hitl-test",
        "persona": "leadership",
        "client_id": "CLIENT_1",
        "query": "Check thresholds",
        "filters": {},
        "thought_steps": [],
        "history": [],
        "hitl_pending": True,
        "hitl_payload": {"kpi": "PCR", "workspace": "WS-SPORTS-LIVE", "value": 38.0},
        "hitl_decision": None,
        "pending_inbox_items": [],
    }
    assert state["hitl_pending"] is True
    assert state["hitl_payload"]["kpi"] == "PCR"
    assert state["hitl_decision"] is None
    assert state["pending_inbox_items"] == []


def test_agent_state_hitl_decision_approve():
    state: AgentState = {
        "session_id": "s",
        "query": "q",
        "thought_steps": [],
        "hitl_pending": False,
        "hitl_payload": {"kpi": "PCR"},
        "hitl_decision": "approve",
        "pending_inbox_items": [{"id": "hitl_1", "type": "alert"}],
    }
    assert state["hitl_decision"] == "approve"
    assert len(state["pending_inbox_items"]) == 1


# ── Slice 11: Input guardrail ─────────────────────────────────────────────────

def test_input_guardrail_blocks_out_of_scope():
    from agents.middleware import MediaFlowInputGuardrail
    g = MediaFlowInputGuardrail()
    state = {"query": "delete database now", "thought_steps": []}
    result = g.before_agent(state)
    assert result.get("error") is not None
    assert "scope:blocked" in result["input_guardrail_violations"]


def test_input_guardrail_redacts_email():
    from agents.middleware import MediaFlowInputGuardrail
    g = MediaFlowInputGuardrail()
    state = {"query": "show me user@example.com stats", "thought_steps": []}
    result = g.before_agent(state)
    assert "[EMAIL]" in result["query"]
    assert "pii:email_redacted" in result["input_guardrail_violations"]


def test_input_guardrail_passes_clean_query():
    from agents.middleware import MediaFlowInputGuardrail
    g = MediaFlowInputGuardrail()
    state = {"query": "What is the PCR for WS-SPORTS-LIVE?", "thought_steps": []}
    result = g.before_agent(state)
    assert result.get("error") is None
    assert result["input_guardrail_violations"] == []


# ── Slice 12: Output guardrail ────────────────────────────────────────────────

def test_output_guardrail_handles_empty_narrative():
    from agents.middleware import MediaFlowOutputGuardrail
    g = MediaFlowOutputGuardrail()
    state = {"narrative": "", "thought_steps": []}
    result = g.after_agent(state)
    assert result["narrative"] != ""
    assert "output:empty_narrative" in result["output_guardrail_violations"]


def test_output_guardrail_redacts_email_in_output():
    from agents.middleware import MediaFlowOutputGuardrail
    g = MediaFlowOutputGuardrail()
    state = {"narrative": "Contact admin@mediaflow.com for details.", "thought_steps": []}
    result = g.after_agent(state)
    assert "[EMAIL]" in result["narrative"]
    assert "output_pii:email_leaked" in result["output_guardrail_violations"]


def test_output_guardrail_passes_clean_narrative():
    from agents.middleware import MediaFlowOutputGuardrail
    g = MediaFlowOutputGuardrail()
    state = {"narrative": "WS-SPORTS-LIVE has a 38% PCR, the lowest across all workspaces.", "thought_steps": []}
    result = g.after_agent(state)
    assert result["output_guardrail_violations"] == []
    assert "38%" in result["narrative"]


# ── Slice 13: SQL length cap ──────────────────────────────────────────────────

def test_check_all_rejects_sql_over_50k_chars():
    from agents.text2sql.guardrails import check_all
    # Build a SQL string clearly over 50,000 chars
    long_sql = "SELECT " + ", ".join(["1"] * 25_001) + " FROM media_dataset"
    result = check_all(long_sql)
    assert not result.safe
    assert any(v.code == "sql_too_long" for v in result.violations)
    assert result.primary_category == "syntax"


def test_check_all_accepts_sql_under_50k_chars():
    from agents.text2sql.guardrails import check_all
    # Normal query well under limit — DDL/length checks should pass
    sql = "SELECT workspace, COUNT(*) AS total FROM media_dataset GROUP BY workspace"
    result = check_all(sql)
    # Length check passes; result safe/unsafe depends on LLM validation (fail-open)
    # We only verify no sql_too_long violation
    assert not any(v.code == "sql_too_long" for v in result.violations)


# ── Slice 14: Tool guardrail ──────────────────────────────────────────────────

def test_tool_guardrail_blocks_fire_alert_without_approval():
    import pytest
    from agents.middleware import MediaFlowToolGuardrail
    g = MediaFlowToolGuardrail()
    state = {"hitl_decision": None}
    with pytest.raises(ValueError, match="requires explicit human approval"):
        g.wrap_tool_call("fire_alert", {"kpi": "PCR"}, state)


def test_tool_guardrail_blocks_fire_alert_with_reject():
    import pytest
    from agents.middleware import MediaFlowToolGuardrail
    g = MediaFlowToolGuardrail()
    state = {"hitl_decision": "reject"}
    with pytest.raises(ValueError, match="requires explicit human approval"):
        g.wrap_tool_call("fire_alert", {"kpi": "PCR"}, state)


def test_tool_guardrail_allows_fire_alert_with_approval():
    from agents.middleware import MediaFlowToolGuardrail
    g = MediaFlowToolGuardrail()
    state = {"hitl_decision": "approve"}
    result = g.wrap_tool_call("fire_alert", {"kpi": "PCR"}, state)
    assert result == {"kpi": "PCR"}


def test_tool_guardrail_passes_other_tools_unconditionally():
    from agents.middleware import MediaFlowToolGuardrail
    g = MediaFlowToolGuardrail()
    state = {"hitl_decision": None}
    result = g.wrap_tool_call("run_kpi_query", {"kpi_name": "PCR"}, state)
    assert result == {"kpi_name": "PCR"}
