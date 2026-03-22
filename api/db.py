"""
DuckDB singleton — read-only connection for all query endpoints.

Uses cursor() per request so concurrent async requests (uvicorn thread-pool)
don't collide on the same connection object, which causes SIGSEGV on Cloud Run.
Admin endpoints use a separate short-lived RW connection.
"""
import math
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


def safe_int(v):
    """Convert to int, treating None and NaN as 0."""
    if v is None:
        return 0
    try:
        if math.isnan(v):
            return 0
    except (TypeError, ValueError):
        pass
    return int(v)


def safe_float(v):
    """Convert to float, treating None and NaN as 0.0."""
    if v is None:
        return 0.0
    try:
        if math.isnan(v):
            return 0.0
    except (TypeError, ValueError):
        pass
    return float(v)


def _rw_connection():
    """Close the RO singleton, yield a short-lived RW connection, then reopen RO."""
    global _conn
    if _conn is not None:
        _conn.close()
        _conn = None
    con = duckdb.connect(str(DB_PATH), read_only=False)
    try:
        yield con
        con.commit()
    finally:
        con.close()
    _conn = duckdb.connect(str(DB_PATH), read_only=True)


def rw_execute(sql: str, params: list | None = None):
    """Run a single RW statement, cycling the RO singleton around it."""
    with _lock:
        for con in _rw_connection():
            con.execute(sql, params or [])


def rw_execute_many(statements: list[tuple[str, list | None]]):
    """Run multiple RW statements in a single connection cycle."""
    with _lock:
        for con in _rw_connection():
            for sql, params in statements:
                con.execute(sql, params or [])
