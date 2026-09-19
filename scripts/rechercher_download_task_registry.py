#!/usr/bin/env python3
"""SQLite task registry shared by Rechercher and independent download workers.

The registry owns task identity/state only. It does not discover sources and it
does not decide copyright or redistribution rights.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import time
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

SCHEMA = """
CREATE TABLE IF NOT EXISTS tasks (
  task_id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  output_path TEXT NOT NULL,
  expected_sha256 TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  worker TEXT,
  last_error TEXT,
  bytes_done INTEGER NOT NULL DEFAULT 0,
  created_at REAL NOT NULL,
  updated_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_url ON tasks(url);
"""

def canonical_url(url: str) -> str:
    p = urlsplit(url.strip())
    return urlunsplit((p.scheme.lower(), p.netloc.lower(), p.path, p.query, ""))

def task_id(url: str, output_path: str) -> str:
    return hashlib.sha256((canonical_url(url) + "\n" + str(output_path)).encode()).hexdigest()

def connect(db: Path) -> sqlite3.Connection:
    db.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db, timeout=30)
    conn.executescript(SCHEMA)
    return conn

def enqueue(db: Path, url: str, output_path: str, expected_sha256: str | None = None) -> str:
    now = time.time()
    tid = task_id(url, output_path)
    with connect(db) as conn:
        conn.execute(
            """INSERT OR IGNORE INTO tasks
               (task_id,url,output_path,expected_sha256,status,created_at,updated_at)
               VALUES (?,?,?,?,?,?,?)""",
            (tid, canonical_url(url), output_path, expected_sha256, "pending", now, now),
        )
    return tid

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--jsonl", required=True)
    args = ap.parse_args()
    db = Path(args.db)
    count = 0
    for line in Path(args.jsonl).read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        item = json.loads(line)
        url = item["url"]
        output = item["output_path"]
        tid = enqueue(db, url, output, item.get("expected_sha256"))
        count += 1
        print(f"ENQUEUED task={tid} url={url}", flush=True)
    print(f"REGISTRY_ENQUEUED={count}", flush=True)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
