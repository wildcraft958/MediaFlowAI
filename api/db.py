"""
DuckDB singleton — read-only connection for all query endpoints.
Admin endpoints that need DDL open a separate short-lived RW connection.
"""
import pathlib
import duckdb

DB_PATH = pathlib.Path(__file__).parents[1] / "analytics.duckdb"

_conn: duckdb.DuckDBPyConnection | None = None


def get_db() -> duckdb.DuckDBPyConnection:
    global _conn
    if _conn is None:
        _conn = duckdb.connect(str(DB_PATH), read_only=True)
    return _conn


def query_df(sql: str, params: list | None = None):
    """Execute SQL and return a pandas DataFrame."""
    return get_db().execute(sql, params or []).df()


def query_one(sql: str, params: list | None = None):
    """Execute SQL and return the first row as a tuple."""
    return get_db().execute(sql, params or []).fetchone()


def rw_execute(sql: str, params: list | None = None):
    """Open a short-lived read-write connection, execute DDL, close immediately."""
    con = duckdb.connect(str(DB_PATH), read_only=False)
    try:
        con.execute(sql, params or [])
        con.commit()
    finally:
        con.close()
