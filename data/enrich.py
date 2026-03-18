"""
Data enrichment pipeline for Frammer AI dataset.

Transforms Corrected_dataset.csv into frammer_dataset.csv with:
  - PS-aligned input_type vocabulary
  - frammer_output_type (what Frammer AI created)
  - processed_date (upload → AI processing lag)
  - frammer_workspace (client workspace identifier)

All random operations use numpy.random.default_rng(seed) for full reproducibility.
Run: python enrich.py
"""

import pandas as pd
import numpy as np
from datetime import timedelta
from pathlib import Path

# ── Vocabulary maps ────────────────────────────────────────────────────────────

# Team → input_type weights (PS vocabulary: interview, speech, debate, etc.)
# Distributions derived from original Frammer data proportions,
# stratified per team to reflect realistic content mix.
TEAM_INPUT_WEIGHTS: dict[str, dict[str, float]] = {
    "Reacts": {
        "debate":          0.35,
        "discussion_show": 0.25,
        "interview":       0.20,
        "press_conference":0.12,
        "speech":          0.08,
    },
    "Music": {
        "interview":       0.40,
        "special_report":  0.30,
        "speech":          0.20,
        "discussion_show": 0.10,
    },
    "Tech": {
        "interview":       0.35,
        "special_report":  0.28,
        "speech":          0.22,
        "news_bulletin":   0.15,
    },
    "Gaming": {
        "interview":       0.30,
        "debate":          0.28,
        "discussion_show": 0.22,
        "press_conference":0.20,
    },
    "Vlog": {
        "interview":       0.38,
        "special_report":  0.25,
        "speech":          0.22,
        "news_bulletin":   0.15,
    },
}

# Default fallback — mirrors overall original Frammer data distribution
_DEFAULT_INPUT_WEIGHTS: dict[str, float] = {
    "interview":       0.28,
    "news_bulletin":   0.23,
    "special_report":  0.17,
    "speech":          0.17,
    "debate":          0.07,
    "press_conference":0.05,
    "discussion_show": 0.03,
}

# input_type → frammer_output_type weights
# Captures Frammer AI output behaviour: interviews → key moments,
# speeches → summaries, reports → chapters, etc.
INPUT_OUTPUT_WEIGHTS: dict[str, dict[str, float]] = {
    "interview": {
        "key_moments":    0.50,
        "chapters":       0.20,
        "full_package":   0.15,
        "summary":        0.10,
        "my_key_moments": 0.05,
    },
    "speech": {
        "summary":        0.40,
        "key_moments":    0.30,
        "chapters":       0.15,
        "full_package":   0.10,
        "my_key_moments": 0.05,
    },
    "debate": {
        "key_moments":    0.45,
        "full_package":   0.25,
        "chapters":       0.15,
        "my_key_moments": 0.10,
        "summary":        0.05,
    },
    "news_bulletin": {
        "key_moments":    0.40,
        "full_package":   0.30,
        "chapters":       0.15,
        "summary":        0.10,
        "my_key_moments": 0.05,
    },
    "special_report": {
        "key_moments":    0.35,
        "chapters":       0.30,
        "full_package":   0.20,
        "summary":        0.10,
        "my_key_moments": 0.05,
    },
    "press_conference": {
        "key_moments":    0.35,
        "summary":        0.30,
        "full_package":   0.20,
        "chapters":       0.10,
        "my_key_moments": 0.05,
    },
    "discussion_show": {
        "key_moments":    0.40,
        "chapters":       0.25,
        "full_package":   0.20,
        "my_key_moments": 0.10,
        "summary":        0.05,
    },
}

# (company, team) → Frammer workspace identifier
TEAM_WORKSPACE: dict[tuple[str, str], str] = {
    ("Company_B", "Reacts"):  "WS-BR-Reacts",
    ("company_A", "Music"):   "WS-AM-Music",
    ("company_A", "Tech"):    "WS-AT-Tech",
    ("company_A", "Gaming"):  "WS-AG-Gaming",
    ("company_A", "Vlog"):    "WS-AV-Vlog",
}


# ── Transformation functions ───────────────────────────────────────────────────

def assign_input_type(team_name: str, rng: np.random.Generator) -> str:
    """Return a PS-aligned input_type sampled from team-specific weights."""
    weights = TEAM_INPUT_WEIGHTS.get(team_name, _DEFAULT_INPUT_WEIGHTS)
    types = list(weights.keys())
    probs = list(weights.values())
    return str(rng.choice(types, p=probs))


def assign_frammer_output_type(input_type: str, rng: np.random.Generator) -> str:
    """Return a Frammer output type correlated with the input content type."""
    weights = INPUT_OUTPUT_WEIGHTS.get(input_type, INPUT_OUTPUT_WEIGHTS["interview"])
    types = list(weights.keys())
    probs = list(weights.values())
    return str(rng.choice(types, p=probs))


def compute_processed_date(upload_date: pd.Timestamp, rng: np.random.Generator) -> pd.Timestamp:
    """
    Return processed_date = upload_date + processing lag.
    Lag drawn from log-normal (μ=ln(4), σ=0.8) in hours, capped at 72h.
    Reflects Frammer AI: most jobs finish in <8h, occasional long tail.
    """
    hours = float(rng.lognormal(mean=np.log(4), sigma=0.8))
    hours = min(hours, 72.0)
    return upload_date + timedelta(hours=hours)


def assign_frammer_workspace(company: str, team_name: str) -> str:
    """Return Frammer workspace ID for a (company, team) pair."""
    key = (company, team_name)
    if key in TEAM_WORKSPACE:
        return TEAM_WORKSPACE[key]
    # Fallback: derive from company + team initials
    co = company[:2].upper()
    tm = team_name[:3].upper()
    return f"WS-{co}-{tm}"


# ── Main enrichment ────────────────────────────────────────────────────────────

def enrich_dataset(df: pd.DataFrame, seed: int = 42) -> pd.DataFrame:
    """
    Apply all enrichment transformations to the raw dataset.
    Returns a new DataFrame — original is not modified.
    """
    rng = np.random.default_rng(seed)
    out = df.copy()

    # 1. Overwrite input_type with PS-aligned vocabulary (team-stratified)
    out["input_type"] = [
        assign_input_type(t, rng) for t in out["team_name"]
    ]

    # 2. Add frammer_output_type — what Frammer AI generated
    out["frammer_output_type"] = [
        assign_frammer_output_type(it, rng) for it in out["input_type"]
    ]

    # 3. Add processed_date — upload + AI processing lag
    out["upload_date"] = pd.to_datetime(out["upload_date"])
    out["processed_date"] = [
        compute_processed_date(d, rng) for d in out["upload_date"]
    ]

    # 4. Add frammer_workspace — replaces the misused 'channel' column
    out["frammer_workspace"] = [
        assign_frammer_workspace(c, t)
        for c, t in zip(out["company"], out["team_name"])
    ]

    # 5. Drop original 'channel' column (it duplicated published_platform)
    out = out.drop(columns=["channel"])

    return out


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    src = Path(__file__).parent.parent / "Corrected_dataset.csv"
    dst = Path(__file__).parent / "frammer_dataset.csv"

    print(f"Loading: {src}")
    df = pd.read_csv(src)
    print(f"Rows loaded: {len(df)}")

    enriched = enrich_dataset(df, seed=42)

    enriched.to_csv(dst, index=False)
    print(f"\nSaved: {dst}")
    print(f"Rows: {len(enriched)} | Columns: {len(enriched.columns)}")
    print(f"\nColumns: {list(enriched.columns)}")

    print(f"\ninput_type distribution:\n{enriched['input_type'].value_counts().to_string()}")
    print(f"\nframmer_output_type distribution:\n{enriched['frammer_output_type'].value_counts().to_string()}")
    print(f"\nframmer_workspace distribution:\n{enriched['frammer_workspace'].value_counts().to_string()}")

    pub_rate = enriched["published_flag"].value_counts(normalize=True)
    print(f"\npublished_flag rate:\n{pub_rate.to_string()}")

    proc = pd.to_datetime(enriched["processed_date"])
    upl = pd.to_datetime(enriched["upload_date"])
    lag_hours = (proc - upl).dt.total_seconds() / 3600
    print(f"\nProcessing lag (hours): mean={lag_hours.mean():.1f}, median={lag_hours.median():.1f}, max={lag_hours.max():.1f}")
