import pathlib
import yaml
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
DuckDB table: frammer_dataset (4569 rows)
Columns: video_id, headline, source, published_flag (BOOLEAN), billable_flag,
upload_date (VARCHAR timestamp), processed_date (VARCHAR timestamp),
video_duration_sec (INT), avg_view_duration_sec, avg_view_percentage,
subscribers_gained, ctr_percentage, impressions, likes, comments, shares,
total_watch_time_hours, traffic_source, published_url,
frammer_workspace (VARCHAR), uploaded_by, team_name, language,
input_type, output_type, frammer_output_type, published_platform, company

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
            "You are a KPI design assistant for Frammer AI analytics dashboard. "
            "Help users define new KPIs using DuckDB SQL.\n\n"
            + _SCHEMA_SUMMARY + "\n" + _KPI_YAML_TEMPLATE + "\n\n"
            "When you have enough info, output a YAML block (```yaml ... ```) and "
            "a SQL view definition (```sql ... ```) for the KPI. "
            "Keep explanations concise."
        )
        history = [{"role": h.get("role", "user"), "content": h.get("content", "")}
                   for h in body.history[-6:]]
        history.append({"role": "user", "content": body.message})

        text = llm_chat(history, system=system, max_tokens=1024)

        yaml_match = re.search(r"```yaml\s*(.*?)```", text, re.DOTALL)
        sql_match  = re.search(r"```sql\s*(.*?)```",  text, re.DOTALL)
        yaml_block = yaml_match.group(1).strip() if yaml_match else None

        return KPIChatResponse(
            explanation=text,
            yaml=yaml_block,
            showAddButton=bool(yaml_match and sql_match),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
