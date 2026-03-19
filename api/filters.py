"""
Shared filter dependency + parameterized WHERE-clause builder.
Zero string interpolation of user-supplied values — all go through positional params.
"""
from __future__ import annotations
from datetime import date
from typing import List, Optional
from fastapi import Query


class FilterParams:
    def __init__(
        self,
        workspace: Optional[List[str]] = Query(None),
        team: Optional[List[str]] = Query(None),
        language: Optional[str] = Query(None),
        input_type: Optional[List[str]] = Query(None),
        ai_output_type: Optional[List[str]] = Query(None),
        uploaded_by: Optional[str] = Query(None),
        date_from: Optional[date] = Query(None),
        date_to: Optional[date] = Query(None),
        metric: str = Query("count"),
        persona: str = Query("leadership"),
    ):
        self.workspace = workspace
        self.team = team
        self.language = language
        self.input_type = input_type
        self.ai_output_type = ai_output_type
        self.uploaded_by = uploaded_by
        self.date_from = date_from
        self.date_to = date_to
        self.metric = metric
        self.persona = persona


def build_where_clause(f: FilterParams, alias: str = "fd") -> tuple[str, list]:
    """
    Returns (WHERE clause string, positional params list).
    Never interpolates user values — only column names come from trusted code paths.
    """
    clauses: list[str] = []
    params: list = []
    col = alias + "." if alias else ""

    if f.workspace:
        placeholders = ", ".join(["?"] * len(f.workspace))
        clauses.append(f"{col}workspace IN ({placeholders})")
        params.extend(f.workspace)

    if f.team:
        placeholders = ", ".join(["?"] * len(f.team))
        clauses.append(f"{col}team_name IN ({placeholders})")
        params.extend(f.team)

    if f.language:
        clauses.append(f"{col}language = ?")
        params.append(f.language)

    if f.input_type:
        placeholders = ", ".join(["?"] * len(f.input_type))
        clauses.append(f"{col}input_type IN ({placeholders})")
        params.extend(f.input_type)

    if f.ai_output_type:
        placeholders = ", ".join(["?"] * len(f.ai_output_type))
        clauses.append(f"{col}ai_output_type IN ({placeholders})")
        params.extend(f.ai_output_type)

    if f.uploaded_by:
        clauses.append(f"{col}uploaded_by = ?")
        params.append(f.uploaded_by)

    if f.date_from:
        clauses.append(f"TRY_CAST({col}upload_date AS TIMESTAMP) >= ?")
        params.append(str(f.date_from))

    if f.date_to:
        clauses.append(f"TRY_CAST({col}upload_date AS TIMESTAMP) <= ?")
        params.append(str(f.date_to))

    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    return where, params
