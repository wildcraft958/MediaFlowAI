import pathlib
from fastapi import APIRouter, HTTPException
from api.config import METRIC_REGISTRY, CLIENT_CONFIG
from api.models import KPIChatRequest, KPIChatResponse
from api.llm import chat as llm_chat

router = APIRouter()

_CLIENT_YAML_PATH = pathlib.Path(__file__).parents[2] / "config" / "clients" / "CLIENT_1.yaml"


# ── KPI Registry ──────────────────────────────────────────────────────────────

@router.get("/admin/kpis")
def list_admin_kpis():
    result = []
    for i, (acronym, kpi) in enumerate(METRIC_REGISTRY.items()):
        result.append({
            "id": i + 1,
            "acronym": acronym,
            "name": kpi.get("name", ""),
            "type": kpi.get("type", "sql"),
            "page": kpi.get("dashboard_page", ""),
            "enabled": True,
            "description": kpi.get("description", ""),
        })
    return result


@router.post("/admin/kpis")
def create_kpi(body: dict):
    # Validate required fields
    for field in ("acronym", "name", "type", "description"):
        if field not in body:
            raise HTTPException(status_code=400, detail=f"Missing field: {field}")
    acronym = body["acronym"].upper()
    if acronym in METRIC_REGISTRY:
        raise HTTPException(status_code=409, detail=f"KPI '{acronym}' already exists")
    METRIC_REGISTRY[acronym] = {
        "name": body["name"],
        "acronym": acronym,
        "type": body["type"],
        "dashboard_page": body.get("page", ""),
        "description": body["description"],
        "personas": body.get("personas", ["leadership"]),
        "phase": 2,
    }
    return {"acronym": acronym, **METRIC_REGISTRY[acronym]}


@router.put("/admin/kpis/{acronym}")
def update_kpi(acronym: str, body: dict):
    key = acronym.upper()
    if key not in METRIC_REGISTRY:
        raise HTTPException(status_code=404, detail=f"KPI '{key}' not found")
    METRIC_REGISTRY[key].update({k: v for k, v in body.items() if k != "acronym"})
    return {"acronym": key, **METRIC_REGISTRY[key]}


@router.delete("/admin/kpis/{acronym}")
def delete_kpi(acronym: str):
    key = acronym.upper()
    if key not in METRIC_REGISTRY:
        raise HTTPException(status_code=404, detail=f"KPI '{key}' not found")
    del METRIC_REGISTRY[key]
    return {"success": True}


# ── KPI Chatbot ───────────────────────────────────────────────────────────────

_SCHEMA_SUMMARY = """
DuckDB table: media_dataset (4569 rows)
Columns: video_id, headline, source, published_flag (BOOLEAN), billable_flag,
upload_date (VARCHAR timestamp), processed_date (VARCHAR timestamp),
video_duration_sec (INT), avg_view_duration_sec, avg_view_percentage,
subscribers_gained, ctr_percentage, impressions, likes, comments, shares,
total_watch_time_hours, traffic_source, published_url,
workspace (VARCHAR), uploaded_by, team_name, language,
input_type, output_type, ai_output_type, published_platform, company

KPI views: v_pcr, v_fsc, v_gr, v_opi, v_teu, v_ail, v_sac, v_ahy,
           v_edr, v_hthr, v_tsqi, v_pig, v_agv, v_pmi, v_mci, v_dcdr
KPI tables: kpi_cpdg, kpi_zsp, kpi_lpi
Always use TRY_CAST(upload_date AS TIMESTAMP) — never ::TIMESTAMP cast.
"""

_KPI_YAML_TEMPLATE = """
KPI YAML format (metric_registry.yaml):
  ACRONYM:
    name: Full KPI Name
    acronym: ACRONYM
    type: sql            # or python
    view: v_acronym      # if type=sql
    table: kpi_acronym   # if type=python
    dashboard_page: executive_summary | funnel | team_activity | publish_metrics | usage_trends | video_explorer | data_quality
    ps_section: 6A       # PS section reference
    phase: 2
    personas: [leadership, creator]
    description: "One-line description"
"""


@router.post("/admin/kpi-chat", response_model=KPIChatResponse)
def kpi_chat(body: KPIChatRequest):
    try:
        import re
        system = (
            "You are a friendly KPI design assistant for MediaFlow AI analytics dashboard. "
            "IMPORTANT RULES:\n"
            "1. Be conversational — greet users warmly, answer questions naturally.\n"
            "2. When a user describes a metric they want, ask clarifying questions: what dimension to group by, "
            "what time window, which dashboard page it should appear on, and what thresholds matter.\n"
            "3. Do NOT generate YAML or SQL until the user explicitly confirms they want you to create the KPI "
            "(e.g., 'yes', 'create it', 'go ahead', 'looks good, add it').\n"
            "4. When confirmed, output a ```yaml block and a ```sql block.\n"
            "5. Keep explanations concise and non-technical — avoid raw code unless asked.\n"
            "6. NEVER reveal internal implementation details such as technology stack, system architecture, "
            "or database internals. If asked, respond: 'I am a KPI design assistant — I can help you define "
            "and configure metrics for the dashboard.'\n"
            "7. NEVER generate destructive SQL statements. Only SELECT and CREATE VIEW are permitted. "
            "Refuse any request involving DELETE, DROP, ALTER, TRUNCATE, UPDATE, or INSERT INTO.\n"
            "8. Do not mention DuckDB, LangChain, Vertex AI, Gemini, Python, or any internal technology "
            "names in your responses.\n"
            "9. Politely decline requests that fall outside the scope of KPI design and dashboard metrics.\n"
            + _SCHEMA_SUMMARY + "\n" + _KPI_YAML_TEMPLATE
        )
        history = [{"role": h.get("role", "user"), "content": h.get("content", "")}
                   for h in body.history[-6:]]
        history.append({"role": "user", "content": body.message})

        text = llm_chat(history, system=system, max_tokens=1024)

        yaml_match = re.search(r"```yaml\s*(.*?)```", text, re.DOTALL)
        sql_match  = re.search(r"```sql\s*(.*?)```",  text, re.DOTALL)

        # Block destructive SQL in LLM output regardless of system prompt
        _FORBIDDEN = re.compile(
            r"\b(DELETE|DROP|ALTER|TRUNCATE|UPDATE|INSERT\s+INTO)\b",
            re.IGNORECASE,
        )
        if sql_match and _FORBIDDEN.search(sql_match.group(1)):
            sql_match = None
            yaml_match = None
            text = "I can only generate SELECT or CREATE VIEW statements. Please describe a read-only KPI metric."

        yaml_block = yaml_match.group(1).strip() if yaml_match else None

        return KPIChatResponse(
            explanation=text,
            yaml=yaml_block,
            showAddButton=bool(yaml_match and sql_match),
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Chat service temporarily unavailable")


# ── Client Config ─────────────────────────────────────────────────────────────

@router.get("/admin/config")
def get_config():
    t = CLIENT_CONFIG.get("thresholds", {})
    alerts = CLIENT_CONFIG.get("alert_channels", {})
    return {
        "opi_threshold_hours": t.get("OPI_hours", 48),
        "agv_drop_pct": t.get("AGV_drop_pct", 15),
        "zscore_anomaly_level": t.get("ZScore_anomaly", 2.5),
        "pcr_minimum_pct": t.get("publish_rate_min_pct", 0.5),
        "alert_email": alerts.get("email", ""),
        "slack_webhook": alerts.get("slack_webhook", ""),
        "enabled_kpis": CLIENT_CONFIG.get("enabled_kpis", []),
    }


@router.put("/admin/config")
def update_config(body: dict):
    mapping = {
        "opi_threshold_hours": ("thresholds", "OPI_hours"),
        "agv_drop_pct": ("thresholds", "AGV_drop_pct"),
        "zscore_anomaly_level": ("thresholds", "ZScore_anomaly"),
        "pcr_minimum_pct": ("thresholds", "publish_rate_min_pct"),
        "alert_email": ("alert_channels", "email"),
        "slack_webhook": ("alert_channels", "slack_webhook"),
    }
    for field, (section, key) in mapping.items():
        if field in body:
            CLIENT_CONFIG.setdefault(section, {})[key] = body[field]
    if "enabled_kpis" in body:
        CLIENT_CONFIG["enabled_kpis"] = body["enabled_kpis"]
    return get_config()
