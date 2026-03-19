"""
KPI MCP Server — FastMCP tools for KPI queries and listing.
Run standalone: uv run python agents/mcp_servers/kpi_server.py
"""
import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).parents[2]))

import yaml
import duckdb
from fastmcp import FastMCP

DB_PATH = str(pathlib.Path(__file__).parents[2] / "frammer.duckdb")
CONFIG_PATH = pathlib.Path(__file__).parents[2] / "config" / "metric_registry.yaml"

mcp = FastMCP("kpi_server")
_conn = None


def _db():
    global _conn
    if _conn is None:
        _conn = duckdb.connect(DB_PATH, read_only=True)
    return _conn


def _registry() -> dict:
    with open(CONFIG_PATH) as f:
        return yaml.safe_load(f)["metrics"]


@mcp.tool()
def run_kpi_query(kpi_name: str, filters: dict) -> list[dict]:
    """
    Execute a pre-computed KPI view with optional filter WHERE clause.

    Args:
        kpi_name: KPI acronym (e.g. 'PCR', 'FSC', 'OPI')
        filters: Optional dict of {column: value} filter pairs

    Returns:
        List of dicts with KPI result rows
    """
    registry = _registry()
    kpi = registry.get(kpi_name.upper())
    if not kpi:
        return [{"error": f"KPI '{kpi_name}' not found in registry"}]

    source = kpi.get("view") or kpi.get("table")
    if not source:
        return [{"error": "KPI has no view or table defined"}]

    # Source comes from trusted YAML
    df = _db().execute(f"SELECT * FROM {source}").df()
    return df.to_dict(orient="records")


@mcp.tool()
def list_kpis(persona: str = "leadership") -> list[dict]:
    """
    Return KPIs available for a given persona.

    Args:
        persona: 'leadership' or 'creator'

    Returns:
        List of KPI metadata dicts
    """
    registry = _registry()
    result = []
    for acronym, kpi in registry.items():
        personas = kpi.get("personas", [])
        if persona in personas or not personas:
            result.append({
                "acronym": acronym,
                "name": kpi.get("name", ""),
                "description": kpi.get("description", ""),
                "page": kpi.get("dashboard_page", ""),
            })
    return result


if __name__ == "__main__":
    mcp.run()
