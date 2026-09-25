#!/usr/bin/env python3
"""Engine B: independent, resumable, parallel PDF downloader.

It consumes only tasks from the SQLite registry. It does not discover sources,
make rights decisions, mutate Corpus, rotate proxies, or bypass DRM.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import random
import re
import sqlite3
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

USER_AGENT = "DinAllah-Engine-B/1.0"
PDF_MAGIC = b"%PDF"

class Registry:
    def __init__(self, path: Path):
        self.path = path
        self.lock = threading.Lock()
        self.conn = sqlite3.connect(path, timeout=30, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript("""
        CREATE TABLE IF NOT EXISTS tasks (
          task_id TEXT PRIMARY KEY, url TEXT NOT NULL, output_path TEXT NOT NULL,
          expected_sha256 TEXT, status TEXT NOT NULL DEFAULT 'pending',
          attempts INTEGER NOT NULL DEFAULT 0, worker TEXT, last_error TEXT,
          bytes_done INTEGER NOT NULL DEFAULT 0, created_at REAL NOT NULL,
          updated_at REAL NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        """)

    def claim(self, worker: str):
        with self.lock, self.conn:
            row = self.conn.execute(
                "SELECT * FROM tasks WHERE status IN ('pending','retry') "
                "ORDER BY created_at LIMIT 1"
            ).fetchone()
            if not row:
                return None
            self.conn.execute(
                "UPDATE tasks SET status='running',worker=?,attempts=attempts+1,updated_at=? WHERE task_id=?",
                (worker, time.time(), row["task_id"]),
            )
            claimed = dict(row)
            claimed["attempts"] = claimed["attempts"] + 1
            return claimed

    def finish(self, task_id: str, status: str, error: str | None = None, bytes_done: int = 0):
        with self.lock, self.conn:
            self.conn.execute(
                "UPDATE tasks SET status=?,last_error=?,bytes_done=?,updated_at=? WHERE task_id=?",
                (status, error, bytes_done, time.time(), task_id),
            )

    def close(self):
        self.conn.close()

def request(url: str, headers: dict[str, str], timeout: int):
    h = {"User-Agent": USER_AGENT, "Accept": "application/pdf,application/octet-stream;q=0.9,*/*;q=0.1"}
    h.update(headers)
    return urlopen(Request(url, headers=h), timeout=timeout)

def probe(url: str, timeout: int):
    try:
        with request(url, {"Range": "bytes=0-0"}, timeout) as r:
            total = None
            cr = r.headers.get("Content-Range", "")
            m = re.search(r"/(\d+)$", cr)
            if m:
                total = int(m.group(1))
            if r.status == 206 and total is not None:
                return {"range": True, "size": total, "status": r.status}
            length = r.headers.get("Content-Length")
            return {"range": False, "size": int(length) if length and length.isdigit() else None, "status": r.status}
    except HTTPError as exc:
        return {"range": False, "size": None, "status": exc.code}
    except Exception:
        return {"range": False, "size": None, "status": None}

def backoff(attempt: int, base: float):
    return min(60.0, base * (2 ** max(0, attempt - 1)) + random.random())

def download_range(url: str, start: int, end: int, part: Path, retries: int, base: float, timeout: int):
    expected = end - start + 1
    current = part.stat().st_size if part.exists() else 0
    if current > expected:
        part.unlink()
        current = 0
    if current == expected:
        return
    for attempt in range(1, retries + 1):
        try:
            first = start + current
            with request(url, {"Range": f"bytes={first}-{end}"}, timeout) as r:
                if r.status != 206:
                    raise RuntimeError(f"range-not-honored:{r.status}")
                mode = "ab" if current else "wb"
                with part.open(mode) as out:
                    while True:
                        chunk = r.read(1024 * 1024)
                        if not chunk:
                            break
                        out.write(chunk)
                if part.stat().st_size != expected:
                    raise RuntimeError(f"short-range:{part.stat().st_size}/{expected}")
                return
        except Exception:
            if attempt == retries:
                raise
            time.sleep(backoff(attempt, base))

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def stream_fallback(url: str, target: Path, retries: int, base: float, timeout: int):
    partial = target.with_suffix(target.suffix + ".part")
    current = partial.stat().st_size if partial.exists() else 0
    for attempt in range(1, retries + 1):
        try:
            headers = {"Range": f"bytes={current}-"} if current else {}
            with request(url, headers, timeout) as r:
                if current and r.status != 206:
                    current = 0
                    partial.unlink(missing_ok=True)
                    continue
                mode = "ab" if current else "wb"
                with partial.open(mode) as out:
                    while True:
                        chunk = r.read(1024 * 1024)
                        if not chunk:
                            break
                        out.write(chunk)
            partial.replace(target)
            return
        except Exception:
            if attempt == retries:
                raise
            time.sleep(backoff(attempt, base))

def download_task(task, args):
    url = task["url"]
    if re.search(r"\.pdf\.enc(?:\?|$)", url, re.I):
        raise RuntimeError("encrypted-pdf-rejected")
    target = Path(task["output_path"])
    target.parent.mkdir(parents=True, exist_ok=True)
    target_part = target.with_suffix(target.suffix + ".part")
    p = probe(url, args.timeout)
    if p["range"] and p["size"] is not None and p["size"] >= args.chunk_bytes * 2:
        size = p["size"]
        chunks = max(1, min(args.connections_per_file, math.ceil(size / args.chunk_bytes)))
        step = math.ceil(size / chunks)
        work = target.with_suffix(target.suffix + ".parts")
        work.mkdir(parents=True, exist_ok=True)
        ranges = [(i * step, min(size - 1, (i + 1) * step - 1)) for i in range(chunks)]
        with ThreadPoolExecutor(max_workers=chunks, thread_name_prefix="engine-b-range") as pool:
            futures = {
                pool.submit(download_range, url, a, b, work / f"{i:04d}.part",
                             args.retries, args.backoff_base, args.timeout): (i, a, b)
                for i, (a, b) in enumerate(ranges)
            }
            for f in as_completed(futures):
                f.result()
        with target.open("wb") as out:
            for i in range(chunks):
                part = work / f"{i:04d}.part"
                with part.open("rb") as src:
                    for block in iter(lambda: src.read(1024 * 1024), b""):
                        out.write(block)
        for part in work.glob("*.part"):
            part.unlink(missing_ok=True)
        work.rmdir()
    else:
        stream_fallback(url, target, args.retries, args.backoff_base, args.timeout)
    if target.read_bytes()[:4] != PDF_MAGIC:
        target.unlink(missing_ok=True)
        raise RuntimeError("pdf-magic-check-failed")
    digest = sha256(target)
    expected = (task.get("expected_sha256") or "").lower()
    if expected and digest != expected:
        target.unlink(missing_ok=True)
        raise RuntimeError(f"sha256-mismatch:{digest}")
    return {"task_id": task["task_id"], "path": str(target), "bytes": target.stat().st_size, "sha256": digest}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--workers", type=int, default=int(os.environ.get("ENGINE_B_WORKERS", "8")))
    ap.add_argument("--connections-per-file", type=int, default=int(os.environ.get("ENGINE_B_CONNECTIONS_PER_FILE", "8")))
    ap.add_argument("--chunk-bytes", type=int, default=int(os.environ.get("ENGINE_B_CHUNK_BYTES", str(8 * 1024 * 1024))))
    ap.add_argument("--retries", type=int, default=int(os.environ.get("ENGINE_B_RETRIES", "5")))
    ap.add_argument("--backoff-base", type=float, default=float(os.environ.get("ENGINE_B_BACKOFF_BASE", "2")))
    ap.add_argument("--timeout", type=int, default=int(os.environ.get("ENGINE_B_TIMEOUT", "120")))
    ap.add_argument("--max-attempts", type=int, default=int(os.environ.get("ENGINE_B_MAX_ATTEMPTS", "3")))
    args = ap.parse_args()
    args.workers = max(1, min(args.workers, 32))
    args.connections_per_file = max(1, min(args.connections_per_file, 32))

    reg = Registry(Path(args.db))
    print(f"ENGINE_B=READY workers={args.workers} connections_per_file={args.connections_per_file}", flush=True)
    summary = []
    def worker_loop(index: int):
        local = []
        worker = f"engine-b-{index}"
        while True:
            task = reg.claim(worker)
            if not task:
                break
            try:
                result = download_task(task, args)
                reg.finish(task["task_id"], "completed", bytes_done=result["bytes"])
                print(f"ENGINE_B COMPLETED task={task['task_id']} bytes={result['bytes']} sha256={result['sha256']}", flush=True)
                local.append({"status": "completed", **result})
            except Exception as exc:
                final_failure = task["attempts"] >= args.max_attempts
                reg.finish(task["task_id"], "failed" if final_failure else "retry", error=str(exc))
                state = "FAILED" if final_failure else "RETRY"
                print(f"ENGINE_B {state} task={task['task_id']} attempt={task['attempts']} error={exc}", flush=True)
                local.append({"status": "failed" if final_failure else "retry", "task_id": task["task_id"], "error": str(exc)})
        return local

    with ThreadPoolExecutor(max_workers=args.workers, thread_name_prefix="engine-b-worker") as pool:
        futures = [pool.submit(worker_loop, i) for i in range(args.workers)]
        for f in as_completed(futures):
            summary.extend(f.result())
    out = Path(args.db).with_suffix(".run-summary.json")
    out.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    failed = [x for x in summary if x["status"] != "completed"]
    print(f"ENGINE_B_SUMMARY completed={len(summary)-len(failed)} failed_or_retry={len(failed)} total={len(summary)}", flush=True)
    reg.close()
    return 1 if failed else 0

if __name__ == "__main__":
    raise SystemExit(main())
