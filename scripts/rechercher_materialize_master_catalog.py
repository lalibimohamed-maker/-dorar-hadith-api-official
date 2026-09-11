#!/usr/bin/env python3
"""Materialize the single Rechercher master catalog.

The master catalog is the only acquisition input. Historical discovery waves are
recovered from immutable git history during migration, then merged into the
master without treating discovery as proof of rights or PDF availability.
Future source files can be placed under books-batches/encyclopedia-master/sources/.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "books-batches/encyclopedia-master/catalog.json"
HISTORY_COMMIT = "ef5dc22c8c677e88cb26b3937a7c1fb9563164c7"
HISTORICAL = [
    "books-batches/salaf-01-400h/catalog.json",
    "books-batches/salaf-01-400h/master-discovery-additions-2026.json",
    "books-batches/salaf-01-400h/worldwide-deep-research-wave-2026-09.json",
]


def load_json_text(text: str):
    return json.loads(text)


def git_history_json(path: str):
    try:
        out = subprocess.check_output(["git", "show", f"{HISTORY_COMMIT}:{path}"], cwd=ROOT, text=True)
        return load_json_text(out)
    except Exception:
        return None


def stable_id(title: str, author: str, death):
    raw = f"{title}|{author}|{death or ''}".encode("utf-8")
    return "master-" + hashlib.sha256(raw).hexdigest()[:20]


def as_book(entry: dict, source: str):
    title = str(entry.get("title") or "").strip()
    author = str(entry.get("author") or "").strip()
    if not title:
        return None
    death = entry.get("author_death_hijri", entry.get("death_hijri"))
    book = dict(entry)
    book["id"] = book.get("id") or stable_id(title, author, death)
    book["source_registry"] = source
    book.setdefault("rights_status", "discovery-only")
    return book


def source_entries(data, source):
    if not isinstance(data, dict):
        return []
    out = []
    for key in ("books", "entries"):
        values = data.get(key)
        if isinstance(values, list):
            for item in values:
                if isinstance(item, dict):
                    b = as_book(item, source)
                    if b:
                        out.append(b)
    return out


def key(book):
    return (str(book.get("title") or "").strip(), str(book.get("author") or "").strip(), book.get("author_death_hijri", book.get("death_hijri")))


def chronology(book):
    value = book.get("chronology_hijri", book.get("author_death_hijri", book.get("death_hijri")))
    try:
        return (0, int(value), str(book.get("title") or ""))
    except (TypeError, ValueError):
        return (1, 999999, str(book.get("title") or ""))


def main():
    if not MASTER.exists():
        raise SystemExit(f"missing master catalog: {MASTER}")
    master = json.loads(MASTER.read_text(encoding="utf-8"))
    books = list(master.get("books") or [])
    merged = {key(b): b for b in books if isinstance(b, dict)}

    for path in HISTORICAL:
        data = git_history_json(path)
        if data:
            for book in source_entries(data, f"git-history:{path}"):
                merged.setdefault(key(book), book)

    source_dir = MASTER.parent / "sources"
    if source_dir.exists():
        for path in sorted(source_dir.glob("*.json")):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                continue
            for book in source_entries(data, f"master-source:{path.relative_to(ROOT)}"):
                merged.setdefault(key(book), book)

    master["schema"] = "din-allah/rechercher-master-catalog/v2"
    master["catalog_id"] = "encyclopedia-unbounded-chronological"
    master["policy"] = "unbounded chronological acquisition from the Prophetic era through present and future additions; no finite book-count target"
    master["books"] = sorted(merged.values(), key=chronology)
    master["materialization"] = {
        "source_of_truth": "this file only",
        "historical_seed_recovery": "immutable git history",
        "future_source_directory": "books-batches/encyclopedia-master/sources/",
        "deduplication": "title + author + chronology",
        "rights_are_not_inferred": True,
        "real_pdf_is_required_for_acquisition": True,
        "verified_pdf_is_never_deleted_by_catalog_cleanup": True,
    }
    MASTER.write_text(json.dumps(master, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"MASTER_CATALOG_MODE=UNBOUNDED")
    print(f"MASTER_CATALOG_RECORDS={len(master['books'])}")
    print("MASTER_CATALOG_TARGET=NONE")
    print("MASTER_CATALOG_STOP_CONDITION=NONE")


if __name__ == "__main__":
    main()
