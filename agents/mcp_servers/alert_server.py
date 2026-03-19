"""
Alert MCP Server — threshold checking and alert dispatch.
"""
import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).parents[2]))

import yaml
import duckdb
from fastmcp import FastMCP

DB_PATH = str(pathlib.Path(__file__).parents[2] / "frammer.duckdb")
CLIENT_YAML = pathlib.Path(__file__).parents[2] / "config" / "clients" / "CLIENT_1.yaml"

mcp = FastMCP("alert_server")
_conn = None


def _db():
    global _conn
    if _conn is None:
        _conn = duckdb.connect(DB_PATH, read_only=True)
    return _conn


def _client_config(client_id: str = "CLIENT_1") -> dict:
    with open(CLIENT_YAML) as f:
        return yaml.safe_load(f)


@mcp.tool()
def check_thresholds(client_id: str = "CLIENT_1") -> list[dict]:
    """
    Evaluate all thresholds in CLIENT_1.yaml against live DuckDB data.

    Returns:
        List of alert dicts: [{kpi, workspace, value, threshold, status}]
    """
    cfg = _client_config(client_id)
    thresholds = cfg.get("thresholds", {})
    alerts = []

    # PCR threshold
    min_pcr = thresholds.get("publish_rate_min_pct", 0.5) * 100
    rows = _db().execute("""
        SELECT frammer_workspace,
               ROUND(SUM(CASE WHEN published_flag=true THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS pcr
        FROM frammer_dataset GROUP BY frammer_workspace
    """).fetchall()
    for ws, pcr in rows:
        if pcr is not None and pcr < min_pcr:
            alerts.append({
                "kpi": "PCR", "workspace": ws,
                "value": pcr, "threshold": min_pcr,
                "status": "ALERT", "message": f"PCR {pcr}% below minimum {min_pcr}%"
            })

    # OPI threshold
    max_opi_hours = thresholds.get("OPI_hours", 48)
    opi_rows = _db().execute("""
        SELECT frammer_workspace, ROUND(SUM(video_duration_sec/3600.0),2) AS orphaned_hours
        FROM frammer_dataset
        WHERE published_flag = false
          AND TRY_CAST(upload_date AS TIMESTAMP) IS NOT NULL
          AND TRY_CAST(upload_date AS TIMESTAMP) < NOW() - INTERVAL '30 days'
        GROUP BY frammer_workspace
    """).fetchall()
    for ws, hours in opi_rows:
        if hours is not None and hours > max_opi_hours:
            alerts.append({
                "kpi": "OPI", "workspace": ws,
                "value": hours, "threshold": max_opi_hours,
                "status": "ALERT", "message": f"Orphaned hours {hours} exceeds {max_opi_hours}h threshold"
            })

    return alerts if alerts else [{"status": "OK", "message": "All thresholds within bounds"}]


@mcp.tool()
def fire_alert(alert: dict) -> dict:
    """
    Dispatch an alert via Slack webhook.
    Email dispatch is planned for future integration (Phase 2).

    Args:
        alert: {kpi, workspace, value, threshold, status, message}

    Returns:
        {dispatched: bool, channels: list[str], message: str}
    """
    cfg = _client_config()
    channels_fired = []

    slack = cfg.get("alert_channels", {}).get("slack_webhook", "")
    # email: future integration — Phase 2 (Cloud Pub/Sub → SendGrid)

    msg = alert.get("message", str(alert))

    if slack:
        try:
            import urllib.request, json
            payload = json.dumps({"text": f"[Frammer Alert] {msg}"}).encode()
            req = urllib.request.Request(slack, data=payload,
                                          headers={"Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=5)
            channels_fired.append("slack")
        except Exception as e:
            channels_fired.append(f"slack:error:{e}")

    return {
        "dispatched": bool(channels_fired),
        "channels": channels_fired,
        "message": msg,
    }


if __name__ == "__main__":
    mcp.run()
