#!/usr/bin/env python3
"""Continuous chronological acquisition for the whole encyclopedia.

There is deliberately no finite book-count target and no era-specific queue.
All catalogued books are merged into one chronological queue ordered by
explicit Hijri chronology metadata, then author death Hijri as the fallback.
The queue state is persistent and each hosted run consumes only the currently
pending prefix. A later run resumes exactly where the previous run stopped.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATE_DIR_NAME = "artifacts/governance/sequential-acquisition"
QUEUE_NAME = "queue.json"


def norm(value):
    return str(value or "").strip().casefold()


def book_key(book):
    return str(book.get("id") or "title:" + norm(book.get("title") or book.get("titleAr")))


def chronology_value(book):
    fields = (
        "chronology_hijri", "hijri_year", "year_hijri", "publication_hijri",
        "author_death_hijri", "deathYear", "death_year_hijri",
    )
    for field in fields:
        value = book.get(field)
        if isinstance(value, dict):
            value = value.get("year") or value.get("hijri")
        try:
            if value is not None and str(value).strip() != "":
                return int(value)
        except (TypeError, ValueError):
            continue
    return None


def chronology_rank(book):
    """Sort from the Prophetic era to the present, then future additions."""
    blob = " ".join(norm(book.get(k)) for k in (
        "target_scope", "scope", "era", "generation", "generation_type",
        "category", "type", "period",
    ))
    if any(x in blob for x in ("future", "مستقبل", "future book")):
        return (3, 10**9, norm(book.get("title") or book.get("titleAr")), book_key(book))

    h = chronology_value(book)
    if h is not None:
        return (1, h, norm(book.get("title") or book.get("titleAr")), book_key(book))

    if any(x in blob for x in ("prophet era", "prophet", "نبوي", "النبي")):
        return (0, 0, norm(book.get("title") or book.get("titleAr")), book_key(book))
    if "quran" in blob or "قرآن" in blob or "qur'an" in blob:
        return (0, 1, norm(book.get("title") or book.get("titleAr")), book_key(book))
    if any(x in blob for x in ("seerah", "sira", "سيرة", "السيرة")):
        return (0, 2, norm(book.get("title") or book.get("titleAr")), book_key(book))
    if any(x in blob for x in ("companion", "sahabi", "sahaba", "صحابي", "صحابة", "الصحابة")):
        return (0, 3, norm(book.get("title") or book.get("titleAr")), book_key(book))
    if any(x in blob for x in ("follower", "tabi", "تابعي", "تابعون", "التابعون")):
        return (0, 4, norm(book.get("title") or book.get("titleAr")), book_key(book))
    return (2, 10**9, norm(book.get("title") or book.get("titleAr")), book_key(book))


def load_catalog(root):
    books = {}
    for path in sorted((root / "books-batches").glob("**/catalog.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        for book in data.get("books", []):
            if isinstance(book, dict):
                books.setdefault(book_key(book), book)
    return sorted(books.values(), key=chronology_rank)


def fingerprint(books):
    payload = "\n".join(f"{book_key(b)}|{chronology_rank(b)[0]}|{chronology_rank(b)[1]}" for b in books)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def load_state(path, books):
    current_fp = fingerprint(books)
    if path.exists():
        try:
            state = json.loads(path.read_text(encoding="utf-8"))
            if state.get("schema") == "rechercher-continuous-hijri-chronological/v1":
                state.setdefault("books", {})
                state.setdefault("order", [])
                state["catalog_fingerprint"] = current_fp
                return state
        except Exception:
            pass
    return {
        "schema": "rechercher-continuous-hijri-chronological/v1",
        "policy": "unbounded chronological acquisition from the Prophetic era through present and future catalog additions; no finite book-count target",
        "order_policy": "Hijri chronology first; explicit chronology metadata preferred; author death Hijri is fallback; future additions remain at the end",
        "catalog_fingerprint": current_fp,
        "order": [book_key(b) for b in books],
        "books": {},
        "run_count": 0,
    }


def save_state(path, state):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=str(ROOT))
    args = parser.parse_args()
    root = Path(args.root).resolve()
    state_path = root / STATE_DIR_NAME / QUEUE_NAME

    books = load_catalog(root)
    state = load_state(state_path, books)
    state["run_count"] = int(state.get("run_count", 0)) + 1
    state["order"] = [book_key(b) for b in books]
    records = state.setdefault("books", {})
    for book in books:
        records.setdefault(book_key(book), {"status": "pending", "attempts": 0, "source_attempts": {}, "last_attempt": None})

    pending = [b for b in books if records.get(book_key(b), {}).get("status") != "acquired"]
    state["pending_before_run"] = len(pending)
    state["total_catalog_books"] = len(books)
    state["finished"] = False
    save_state(state_path, state)

    if not pending:
        state["finished"] = True
        state["pending_after_run"] = 0
        save_state(state_path, state)
        print("CONTINUOUS_QUEUE_COMPLETE: no pending catalogued books", flush=True)
        return

    with tempfile.TemporaryDirectory(prefix="rechercher-continuous-") as td:
        temp = Path(td)
        (temp / "books-batches" / "chronological").mkdir(parents=True)
        (temp / "scripts").symlink_to(root / "scripts", target_is_directory=True)
        (temp / "artifacts").symlink_to(root / "artifacts", target_is_directory=True)
        catalog = temp / "books-batches" / "chronological" / "catalog.json"
        catalog.write_text(json.dumps({"books": pending}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        env = os.environ.copy()
        env["RECHERCHER_MAX_SOURCE_ATTEMPTS"] = "24"
        env["RECHERCHER_REEVALUATE_EXISTING"] = "1"
        worker = root / "scripts" / "rechercher_pdf_acquire.py"
        print(f"CONTINUOUS_QUEUE_RUN={state['run_count']} TOTAL={len(books)} PENDING={len(pending)}", flush=True)
        print("CHRONOLOGY_POLICY=Prophet -> Hijri chronology -> present -> future additions", flush=True)
        result = subprocess.run(["python3", str(worker), "--root", str(temp)], cwd=root, env=env)

    summary_path = root / "artifacts" / "acquisition-run-summary.json"
    try:
        summary = json.loads(summary_path.read_text(encoding="utf-8")) if summary_path.exists() else []
    except Exception:
        summary = []
    if not isinstance(summary, list):
        summary = []

    by_id = {str(x.get("id")): x for x in summary if isinstance(x, dict) and x.get("id") is not None}
    for book in pending:
        key = book_key(book)
        rec = records.setdefault(key, {"status": "pending", "attempts": 0, "source_attempts": {}, "last_attempt": None})
        rec["attempts"] = int(rec.get("attempts", 0)) + 1
        rec["last_attempt"] = state["run_count"]
        outcome = by_id.get(str(book.get("id")))
        if outcome:
            rec["last_result"] = outcome.get("status")
            # Preserve detailed source attempts when the worker reports them.
            attempts = outcome.get("attempts")
            if isinstance(attempts, list):
                for attempt in attempts:
                    if not isinstance(attempt, dict):
                        continue
                    source = str(attempt.get("source") or attempt.get("engine") or "unknown")
                    rec["source_attempts"][source] = int(rec["source_attempts"].get(source, 0)) + 1
        if outcome and outcome.get("status") == "acquired":
            rec["status"] = "acquired"
            rec["sha256"] = outcome.get("sha256")
        else:
            rec["status"] = "pending"

    state["pending_after_run"] = sum(1 for b in books if records.get(book_key(b), {}).get("status") != "acquired")
    state["finished"] = state["pending_after_run"] == 0
    state["last_exit_code"] = result.returncode
    save_state(state_path, state)
    print(f"CONTINUOUS_QUEUE_AFTER={state['pending_after_run']} EXIT={result.returncode}", flush=True)

    if result.returncode != 0 and not state["finished"]:
        raise SystemExit(result.returncode)


if __name__ == "__main__":
    main()
