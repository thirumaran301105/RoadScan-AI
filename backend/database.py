"""
Database Module
------------------
Previously, all detected potholes lived only in an in-memory Python dict -
meaning every server restart silently wiped out everything ever detected.
This adds real persistence using SQLite (built into Python, no extra
server or setup needed) so potholes survive restarts, crashes, and
redeployments.

Design: the in-memory dict is still what the rest of the codebase reads
and writes during a single request (fast, and doesn't require rewriting
every function that currently takes `potholes: dict`) - this module just
syncs that dict to/from SQLite at the right moments:
  - `load_all_potholes()` on server startup, to rehydrate the dict
  - `save_all_potholes()` after any request that changed something, to
    persist it back out
"""
import sqlite3
import os
from typing import Dict

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "roadscan.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS potholes (
    pothole_id TEXT PRIMARY KEY,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    severity TEXT NOT NULL,
    confidence REAL NOT NULL,
    first_seen REAL NOT NULL,
    last_seen REAL NOT NULL,
    sighting_count INTEGER NOT NULL,
    road_type TEXT NOT NULL,
    status TEXT NOT NULL,
    clean_pass_streak INTEGER NOT NULL,
    priority_score REAL,
    estimated_repair_cost_inr INTEGER
);
"""

COLUMNS = [
    "pothole_id", "latitude", "longitude", "severity", "confidence",
    "first_seen", "last_seen", "sighting_count", "road_type", "status",
    "clean_pass_streak", "priority_score", "estimated_repair_cost_inr",
]


def _get_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = _get_connection()
    try:
        conn.execute(SCHEMA)
        conn.commit()
    finally:
        conn.close()


def load_all_potholes() -> Dict[str, dict]:
    """Called once at startup to rehydrate the in-memory dict from disk."""
    conn = _get_connection()
    try:
        conn.execute(SCHEMA)  # defensive - safe/no-op if the table already exists
        conn.commit()
        rows = conn.execute("SELECT * FROM potholes").fetchall()
        return {row["pothole_id"]: dict(row) for row in rows}
    finally:
        conn.close()


def save_all_potholes(potholes: Dict[str, dict]):
    """Full upsert of the current in-memory state - called after any
    request that may have changed something. Simple and correct rather
    than tracking exactly which records changed; fine at the scale of
    potholes-per-city, not big enough to need finer-grained syncing."""
    if not potholes:
        return
    conn = _get_connection()
    try:
        placeholders = ", ".join("?" for _ in COLUMNS)
        columns_str = ", ".join(COLUMNS)
        sql = f"INSERT OR REPLACE INTO potholes ({columns_str}) VALUES ({placeholders})"
        rows = [tuple(record.get(col) for col in COLUMNS) for record in potholes.values()]
        conn.executemany(sql, rows)
        conn.commit()
    finally:
        conn.close()


def delete_all():
    """Useful for tests/resets - not called anywhere in normal operation."""
    conn = _get_connection()
    try:
        conn.execute("DELETE FROM potholes")
        conn.commit()
    finally:
        conn.close()
