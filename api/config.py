"""
Load YAML configs once at startup.
"""
import pathlib
import yaml

_ROOT = pathlib.Path(__file__).parents[1]


def _load(path: pathlib.Path) -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


METRIC_REGISTRY: dict = _load(_ROOT / "config" / "metric_registry.yaml")["metrics"]
DIMENSIONS: dict = _load(_ROOT / "config" / "dimensions.yaml")["dimensions"]
CLIENT_CONFIG: dict = _load(_ROOT / "config" / "clients" / "CLIENT_1.yaml")

# Column allowlist for crosstab D1/D2 — derived from dimensions.yaml source_column values
CROSSTAB_ALLOWED_COLUMNS: dict[str, str] = {
    dim_name: dim_data["source_column"]
    for dim_name, dim_data in DIMENSIONS.items()
    if dim_data.get("cardinality") != "continuous"
}
# e.g. {"workspace": "workspace", "team": "team_name", ...}
