"""
DuckDB singleton — read-only connection for all query endpoints.

Uses cursor() per request so concurrent async requests (uvicorn thread-pool)
don't collide on the same connection object, which causes SIGSEGV on Cloud Run.
A threading Lock protects cursor creation from the shared connection.
Admin endpoints use a separate short-lived RW connection.
"""
import pathlib
import threading
import duckdb

DB_PATH = pathlib.Path(__file__).parents[1] / "analytics.duckdb"

_conn: duckdb.DuckDBPyConnection | None = None
_lock = threading.Lock()


def get_db() -> duckdb.DuckDBPyConnection:
    global _conn
    if _conn is None:
        _conn = duckdb.connect(str(DB_PATH), read_only=True)
    return _conn


def query_df(sql: str, params: list | None = None):
    """Execute SQL and return a pandas DataFrame."""
    with _lock:
        cur = get_db().cursor()
    try:
        return cur.execute(sql, params or []).df()
    finally:
        cur.close()


def query_one(sql: str, params: list | None = None):
    """Execute SQL and return the first row as a tuple, or None."""
    with _lock:
        cur = get_db().cursor()
    try:
        return cur.execute(sql, params or []).fetchone()
    finally:
        cur.close()


def rw_execute(sql: str, params: list | None = None):
    """Open a short-lived read-write connection, execute DDL, close immediately."""
    con = duckdb.connect(str(DB_PATH), read_only=False)
    try:
        con.execute(sql, params or [])
        con.commit()
    finally:
        con.close()
