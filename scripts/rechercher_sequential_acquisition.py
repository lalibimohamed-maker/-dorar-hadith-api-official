#!/usr/bin/env python3
"""Continuous chronological acquisition for the whole encyclopedia.

There is deliberately no finite book-count target and no era-specific queue.
All catalogued books are merged into one chronological queue ordered by
explicit Hijri chronology metadata, then author death Hijri as the fallback.
The queue state is persistent and each hosted run consumes only the currently
pending prefix. A later run resumes exactly where the previous run stopped.

Before handing books to the strict PDF engine, this runner resolves missing
expected-volume counts from explicit catalog metadata, edition text, structured
source metadata and conservative source-page PDF enumeration. It never guesses
one volume merely because the count is missing.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import quote, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
STATE_DIR_NAME = "artifacts/governance/sequential-acquisition"
QUEUE_NAME = "queue.json"
USER_AGENT = "DinAllah-Encyclopedia/1.3"
VOLUME_FIELDS = ("expected_volumes", "volume_count", "num_volumes", "volumes")


def norm(value):
    return str(value or "").strip().casefold()


def book_key(book):
    return str(book.get("id") or "title:" + norm(book.get("title") or book.get("titleAr")))


def chronology_value(book):
    fields = ("chronology_hijri", "hijri_year", "year_hijri", "publication_hijri", "author_death_hijri", "deathYear", "death_year_hijri")
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
    blob = " ".join(norm(book.get(k)) for k in ("target_scope", "scope", "era", "generation", "generation_type", "category", "type", "period"))
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
            if not isinstance(book, dict):
                continue
            key = book_key(book)
            if key not in books:
                books[key] = dict(book)
                continue
            merged = books[key]
            for field, value in book.items():
                if field not in merged or merged.get(field) in (None, "", [], {}):
                    merged[field] = value
            if isinstance(merged.get("sources"), list) and isinstance(book.get("sources"), list):
                seen = {json.dumps(x, ensure_ascii=False, sort_keys=True) for x in merged["sources"]}
                for value in book["sources"]:
                    marker = json.dumps(value, ensure_ascii=False, sort_keys=True)
                    if marker not in seen:
                        merged["sources"].append(value)
                        seen.add(marker)
    return sorted(books.values(), key=chronology_rank)


def fingerprint(books):
    payload = "\n".join(f"{book_key(b)}|{chronology_rank(b)[0]}|{chronology_rank(b)[1]}|{resolve_explicit_volume_count(b) or ''}" for b in books)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def save_state(path, state):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_state(path, books):
    current_fp = fingerprint(books)
    if path.exists():
        try:
            state = json.loads(path.read_text(encoding="utf-8"))
            if state.get("schema") == "rechercher-continuous-hijri-chronological/v2":
                state.setdefault("books", {})
                state.setdefault("order", [])
                state["catalog_fingerprint"] = current_fp
                return state
        except Exception:
            pass
    return {
        "schema": "rechercher-continuous-hijri-chronological/v2",
        "policy": "unbounded chronological acquisition from the Prophetic era through present and future catalog additions; no finite book-count target",
        "order_policy": "Hijri chronology first; explicit chronology metadata preferred; author death Hijri is fallback; future additions remain at the end",
        "volume_policy": "explicit metadata > structured source metadata > explicit edition/source PDF enumeration; never default to one volume without evidence",
        "catalog_fingerprint": current_fp,
        "order": [book_key(b) for b in books],
        "books": {},
        "run_count": 0,
    }


def normalize_url(url):
    p = urlsplit(str(url))
    return urlunsplit((p.scheme, p.netloc, quote(p.path, safe="/%:@-._~"), p.query, p.fragment))


def fetch_text(url):
    req = Request(normalize_url(url), headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=25) as r:
        return r.read().decode("utf-8", "replace")


def pdf_links(page, base):
    out, seen = [], set()
    for m in re.finditer(r'href=[\"\']([^\"\']+)[\"\']', page, re.I):
        u = normalize_url(urljoin(base, html.unescape(m.group(1))))
        if re.search(r"\.pdf(?:\?|$)", u, re.I) and not re.search(r"\.pdf\.enc(?:\?|$)", u, re.I) and u not in seen:
            seen.add(u)
            out.append(u)
    return out


def positive_int(value):
    if isinstance(value, bool):
        return None
    try:
        value = int(value)
    except (TypeError, ValueError):
        return None
    return value if value > 0 and value <= 100 else None


def resolve_explicit_volume_count(book):
    for key in VOLUME_FIELDS:
        count = positive_int(book.get(key))
        if count:
            return count
    sources = book.get("sources") or []
    if not isinstance(sources, list):
        sources = [sources]
    for source in sources:
        if not isinstance(source, dict):
            continue
        for key in VOLUME_FIELDS:
            count = positive_int(source.get(key))
            if count:
                return count
        mapping = source.get("volume_url_map")
        if isinstance(mapping, dict) and mapping:
            numeric_keys = [k for k in mapping if str(k).isdigit() and int(k) > 0]
            if numeric_keys:
                return max(int(k) for k in numeric_keys)
    for key in ("edition", "note", "notes", "description"):
        text = str(book.get(key) or "")
        m = re.search(r"(?<!\d)(\d{1,2})\s*(?:مجلد(?:ًا|اً|ات)?|جزء(?:ًا|اً|ا|ء)?|vol(?:ume)?s?\b)", text, re.I)
        if m:
            count = positive_int(m.group(1))
            if count:
                return count
    return None


def source_urls(book):
    values = []
    for source in book.get("sources") or []:
        if isinstance(source, str):
            values.append(source)
        elif isinstance(source, dict) and source.get("url"):
            values.append(source["url"])
    for key in ("source_url", "url", "waqfeya_url", "archive_url", "internet_archive_url", "openlibrary_url"):
        if book.get(key):
            values.append(book[key])
    seen = set()
    out = []
    for value in values:
        try:
            u = normalize_url(value)
        except Exception:
            continue
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def infer_volume_count_from_sources(book):
    explicit = resolve_explicit_volume_count(book)
    if explicit:
        return explicit, "explicit-metadata"
    direct_pdf_count = None
    page_counts = []
    for url in source_urls(book)[:8]:
        if re.search(r"\.pdf(?:\?|$)", url, re.I) and not re.search(r"\.pdf\.enc(?:\?|$)", url, re.I):
            direct_pdf_count = 1 if direct_pdf_count is None else direct_pdf_count
            continue
        try:
            page = fetch_text(url)
            links = pdf_links(page, url)
        except Exception:
            continue
        if len(links) == 1:
            page_counts.append(1)
        elif len(links) > 1:
            page_counts.append(len(links))
    if page_counts:
        unique = sorted(set(page_counts))
        if len(unique) == 1:
            return unique[0], "source-page-pdf-enumeration"
    if direct_pdf_count == 1:
        return 1, "direct-pdf-source"
    return None, "unresolved"


def resolve_volumes_for_book(book, record):
    existing = positive_int(record.get("resolved_expected_volumes")) if isinstance(record, dict) else None
    if existing:
        return existing, str(record.get("volume_resolution_method") or "persistent-state")
    count, method = infer_volume_count_from_sources(book)
    if count:
        return count, method
    return None, method


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

    resolved = 0
    unresolved = []
    for book in pending:
        key = book_key(book)
        rec = records.setdefault(key, {"status": "pending", "attempts": 0, "source_attempts": {}, "last_attempt": None})
        count, method = resolve_volumes_for_book(book, rec)
        if count:
            book["expected_volumes"] = count
            rec["resolved_expected_volumes"] = count
            rec["volume_resolution_method"] = method
            resolved += 1
            print(f"VOLUME_RESOLVED {key}: expected_volumes={count} method={method}", flush=True)
        else:
            unresolved.append(key)
            rec["volume_resolution_method"] = method
            print(f"VOLUME_UNRESOLVED {key}: no safe volume-count evidence", flush=True)
    state["volume_resolution"] = {"resolved": resolved, "unresolved": len(unresolved), "unresolved_ids": unresolved}
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
        worker = root / "scripts" / "rechercher_acquisition_engine.py"
        print(f"CONTINUOUS_QUEUE_RUN={state['run_count']} TOTAL={len(books)} PENDING={len(pending)}", flush=True)
        print("CHRONOLOGY_POLICY=Prophet -> Hijri chronology -> present -> future additions", flush=True)
        print(f"VOLUME_RESOLUTION={resolved} resolved / {len(unresolved)} unresolved", flush=True)
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
