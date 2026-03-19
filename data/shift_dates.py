"""
Date shift utility for Frammer AI dataset.

The synthetic dataset was originally generated with upload dates spanning
2024-11-19 → 2025-11-19 (1 year). Since the dashboard's daily-trends chart
uses a rolling window relative to NOW(), all rows fell outside the default
90-day window once real time advanced past 2025-11-19.

This script shifts ALL timestamps forward so that:
  max(upload_date) == today at midnight

Result: the dataset always shows "last 12 months of activity" relative to
the current date, making every time-series feature usable out of the box.

Usage:
    python data/shift_dates.py           # shift CSV in-place, then rebuild DuckDB
    python data/shift_dates.py --dry-run # print shift amount only, no writes

After running, rebuild DuckDB:
    python data/schema.py

Columns shifted: upload_date, processed_date
All other columns are left untouched.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import pandas as pd

_CSV = Path(__file__).parent / "frammer_dataset.csv"
_SCHEMA = Path(__file__).parent / "schema.py"
DATE_COLS = ["upload_date", "processed_date"]


def compute_shift(df: pd.DataFrame) -> timedelta:
    """Return the timedelta to add to all dates so max(upload_date) == today."""
    max_upload = pd.to_datetime(df["upload_date"], errors="coerce").max()
    today_midnight = datetime.combine(date.today(), datetime.min.time())
    delta = today_midnight - max_upload.replace(tzinfo=None)
    return delta


def apply_shift(df: pd.DataFrame, delta: timedelta) -> pd.DataFrame:
    df = df.copy()
    for col in DATE_COLS:
        parsed = pd.to_datetime(df[col], errors="coerce")
        shifted = parsed + delta
        # Write back in the same ISO format the CSV already uses
        df[col] = shifted.dt.strftime("%Y-%m-%d %H:%M:%S.%f")
    return df


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print shift amount only; do not modify any files."
    )
    args = parser.parse_args()

    if not _CSV.exists():
        sys.exit(f"ERROR: {_CSV} not found. Run data/enrich.py first.")

    df = pd.read_csv(_CSV, low_memory=False)

    delta = compute_shift(df)
    days_shifted = delta.days
    old_max = pd.to_datetime(df["upload_date"], errors="coerce").max().date()
    new_max = old_max + timedelta(days=days_shifted)
    old_min = pd.to_datetime(df["upload_date"], errors="coerce").min().date()
    new_min = old_min + timedelta(days=days_shifted)

    print(f"Shift amount  : +{days_shifted} days ({delta})")
    print(f"upload_date   : {old_min} → {old_max}  BECOMES  {new_min} → {new_max}")

    if args.dry_run:
        print("Dry-run mode — no files written.")
        return

    df_shifted = apply_shift(df, delta)
    df_shifted.to_csv(_CSV, index=False)
    print(f"\nWrote shifted CSV → {_CSV}")

    # Rebuild DuckDB
    print("Rebuilding frammer.duckdb …")
    result = subprocess.run(
        [sys.executable, str(_SCHEMA)],
        cwd=_SCHEMA.parent.parent,
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print("schema.py stderr:", result.stderr[-2000:])
        sys.exit(f"ERROR: schema.py failed (exit {result.returncode})")
    print("frammer.duckdb rebuilt successfully.")
    print("\nDone. Re-run 'uv run pytest data/test_enrich.py' to verify tests still pass.")


if __name__ == "__main__":
    main()
