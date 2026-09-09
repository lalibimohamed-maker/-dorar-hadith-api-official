#!/usr/bin/env python3
"""Supplementary Dorar book index discovery for Rechercher.

This module is deliberately discovery-only:
- fetches /v1/data/book from a configurable Dorar API endpoint;
- records the remote book index for provenance/audit;
- matches catalog titles conservatively by normalized exact title;
- never grants acquisition or redistribution rights;
- never downloads a PDF from the API.
"""
import argparse
import json
import os
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen

DEFAULT_API_BASE = os.environ.get(
    "RECHERCHER_DORAR_API_BASE",
    "https://dorar-hadith-api-1.onrender.com",
).rstrip("/")
USER_AGENT = "DinAllah-Encyclopedia-Rechercher/1.0"
TIMEOUT = 45

ARABIC_MARKS = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]")
SPACE = re.compile(r"\s+")


def normalize_title(value):
    value = unicodedata.normalize("NFKC", str(value or ""))
    value = value.replace("ـ", "")
    value = ARABIC_MARKS.sub("", value)
    value = value.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
    value = value.replace("ى", "ي")
    value = SPACE.sub(" ", value).strip().casefold()
    return value


def fetch_json(url):
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urlopen(req, timeout=TIMEOUT) as response:
        return json.loads(response.read().decode("utf-8"))


def extract_items(payload):
    data = payload.get("data", payload) if isinstance(payload, dict) else payload
    if isinstance(data, dict):
        for key in ("books", "data", "items", "results"):
            if isinstance(data.get(key), list):
                data = data[key]
                break
    if not isinstance(data, list):
        raise ValueError("Dorar /v1/data/book response does not contain a book list")
    items = []
    for item in data:
        if isinstance(item, dict):
            book_id = item.get("id", item.get("key", item.get("bookId")))
            name = item.get("name", item.get("value", item.get("title", item.get("book"))))
        elif isinstance(item, (list, tuple)) and len(item) >= 2:
            book_id, name = item[0], item[1]
        else:
            continue
        if book_id is None or not str(name or "").strip():
            continue
        items.append({"book_id": str(book_id), "name": str(name).strip()})
    # De-duplicate by remote ID while retaining first-seen provenance.
    dedup = {}
    for item in items:
        dedup.setdefault(item["book_id"], item)
    return list(dedup.values())


def load_catalog_books(root):
    books = {}
    for catalog_path in sorted((root / "books-batches").glob("**/catalog.json")):
        payload = json.loads(catalog_path.read_text(encoding="utf-8"))
        for book in payload.get("books", []):
            book_id = str(book.get("id") or "").strip()
            if book_id:
                books.setdefault(book_id, {**book, "catalog_path": str(catalog_path.relative_to(root))})
    return list(books.values())


def build_matches(books, remote_items):
    by_title = {}
    for item in remote_items:
        by_title.setdefault(normalize_title(item["name"]), []).append(item)
    rows = []
    counts = {"catalog_books": len(books), "exact_title_matches": 0, "unmatched": 0, "ambiguous_matches": 0}
    for book in books:
        title = str(book.get("title") or "").strip()
        candidates = by_title.get(normalize_title(title), []) if title else []
        if len(candidates) == 1:
            status = "MATCHED-EXACT-TITLE"
            counts["exact_title_matches"] += 1
        elif len(candidates) > 1:
            status = "MATCHED-AMBIGUOUS-TITLE"
            counts["ambiguous_matches"] += 1
        else:
            status = "NO-DORAR-TITLE-MATCH"
            counts["unmatched"] += 1
        rows.append({
            "book_id": str(book.get("id")),
            "title": title,
            "author": book.get("author"),
            "catalog_path": book.get("catalog_path"),
            "match_status": status,
            "dorar_books": candidates,
            "policy": "discovery-only; no acquisition or redistribution permission inferred",
        })
    return counts, rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--api-base", default=DEFAULT_API_BASE)
    args = parser.parse_args()
    root = Path(args.root).resolve()
    gov = root / "artifacts" / "governance"
    gov.mkdir(parents=True, exist_ok=True)

    endpoint = urljoin(args.api_base.rstrip("/") + "/", "v1/data/book")
    fetched_at = datetime.now(timezone.utc).isoformat()
    try:
        payload = fetch_json(endpoint)
        remote_items = extract_items(payload)
    except Exception as exc:
        # Supplementary source: preserve acquisition continuity when unavailable.
        failure = {
            "source": endpoint,
            "fetched_at": fetched_at,
            "status": "UNAVAILABLE",
            "error": str(exc),
            "policy": "discovery-only; acquisition must continue from saved governed sources",
        }
        (gov / "dorar-book-index.json").write_text(json.dumps(failure, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"[DORAR] supplementary index unavailable: {exc}", flush=True)
        return 0

    books = load_catalog_books(root)
    counts, rows = build_matches(books, remote_items)
    index = {
        "schema": "rechercher-dorar-book-index/v1",
        "source": endpoint,
        "fetched_at": fetched_at,
        "remote_book_count": len(remote_items),
        "books": remote_items,
        "policy": "discovery-only; no acquisition or redistribution permission inferred",
    }
    report = {
        "schema": "rechercher-dorar-catalog-match/v1",
        "source": endpoint,
        "fetched_at": fetched_at,
        "counts": counts,
        "matches": rows,
        "policy": "Exact-title matching is advisory only; rights and PDF availability remain governed by the acquisition ledger.",
    }
    (gov / "dorar-book-index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (gov / "dorar-catalog-match.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[DORAR] remote books: {len(remote_items)}", flush=True)
    print(f"[DORAR] catalog books: {counts['catalog_books']}", flush=True)
    print(f"[DORAR] exact title matches: {counts['exact_title_matches']}", flush=True)
    print(f"[DORAR] ambiguous title matches: {counts['ambiguous_matches']}", flush=True)
    print(f"[DORAR] unmatched: {counts['unmatched']}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
