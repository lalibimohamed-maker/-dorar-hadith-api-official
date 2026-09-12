#!/usr/bin/env python3
"""Resolve safe expected-volume counts before the strict PDF engine runs.

Evidence order:
1. explicit book/source volume metadata;
2. explicit source volume maps or complete per-volume source entries;
3. conservative source-page PDF enumeration;
4. a direct PDF source is exactly one volume.

No value is guessed from title/author alone. Unresolved books remain pending.
The resolution ledger is persisted so future runs can reuse the same evidence.
"""
from __future__ import annotations

import html
import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import quote, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "books-batches/encyclopedia-master/catalog.json"
LEDGER = ROOT / "artifacts/governance/sequential-acquisition/volume-resolution.json"
USER_AGENT = "DinAllah-Encyclopedia-Rechercher/2.0"
VOLUME_FIELDS = ("expected_volumes", "volume_count", "num_volumes", "volumes")
MAX_SOURCE_URLS = 8


def positive_int(value):
    if isinstance(value, bool):
        return None
    try:
        value = int(value)
    except (TypeError, ValueError):
        return None
    return value if 0 < value <= 100 else None


def normalize_url(url):
    p = urlsplit(str(url))
    return urlunsplit((p.scheme, p.netloc, quote(p.path, safe="/%:@-._~"), p.query, p.fragment))


def fetch_text(url):
    req = Request(normalize_url(url), headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=25) as response:
        return response.read().decode("utf-8", "replace")


def pdf_links(page, base):
    out, seen = [], set()
    for match in re.finditer(r'href=[\"\']([^\"\']+)[\"\']', page, re.I):
        url = normalize_url(urljoin(base, html.unescape(match.group(1))))
        if re.search(r"\.pdf(?:\?|$)", url, re.I) and not re.search(r"\.pdf\.enc(?:\?|$)", url, re.I) and url not in seen:
            seen.add(url)
            out.append(url)
    return out


def book_key(book):
    title = str(book.get("title") or book.get("titleAr") or "").strip().casefold()
    return str(book.get("id") or f"title:{title}")


def explicit_count(book):
    for field in VOLUME_FIELDS:
        count = positive_int(book.get(field))
        if count:
            return count, "explicit-book-metadata"

    sources = book.get("sources") or []
    if not isinstance(sources, list):
        sources = [sources]

    volume_numbers = []
    for source in sources:
        if isinstance(source, dict):
            for field in VOLUME_FIELDS:
                count = positive_int(source.get(field))
                if count:
                    return count, f"explicit-source-metadata:{field}"
            mapping = source.get("volume_url_map")
            if isinstance(mapping, dict):
                keys = [int(k) for k in mapping if str(k).isdigit() and int(k) > 0]
                if keys:
                    return max(keys), "source-volume-url-map"
            vol = positive_int(source.get("volume"))
            if vol:
                volume_numbers.append(vol)

    if volume_numbers:
        unique = sorted(set(volume_numbers))
        if unique == list(range(1, max(unique) + 1)):
            return len(unique), "complete-explicit-source-volume-series"

    for field in ("edition", "note", "notes", "description"):
        text = str(book.get(field) or "")
        match = re.search(
            r"(?<!\d)(\d{1,2})\s*(?:مجلد(?:ًا|اً|ات)?|جزء(?:ًا|اً|ا|ء)?|vol(?:ume)?s?\b)",
            text,
            re.I,
        )
        if match:
            count = positive_int(match.group(1))
            if count:
                return count, f"explicit-text-metadata:{field}"

    return None, "unresolved"


def source_urls(book):
    values = []
    for source in book.get("sources") or []:
        if isinstance(source, str):
            values.append(source)
        elif isinstance(source, dict) and source.get("url"):
            values.append(source["url"])
    for field in ("source_url", "url", "waqfeya_url", "archive_url", "internet_archive_url", "openlibrary_url"):
        if book.get(field):
            values.append(book[field])

    seen, result = set(), []
    for value in values:
        try:
            url = normalize_url(value)
        except Exception:
            continue
        if url not in seen:
            seen.add(url)
            result.append(url)
    return result[:MAX_SOURCE_URLS]


def infer_count(book):
    count, method = explicit_count(book)
    if count:
        return count, method

    direct_pdf = False
    page_counts = []
    for url in source_urls(book):
        if re.search(r"\.pdf(?:\?|$)", url, re.I) and not re.search(r"\.pdf\.enc(?:\?|$)", url, re.I):
            direct_pdf = True
            continue
        try:
            links = pdf_links(fetch_text(url), url)
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

    if direct_pdf:
        return 1, "direct-pdf-source"

    return None, "unresolved"


def main():
    if not MASTER.is_file():
        raise SystemExit(f"missing master catalog: {MASTER}")

    data = json.loads(MASTER.read_text(encoding="utf-8"))
    books = data.get("books", [])
    if not isinstance(books, list):
        raise SystemExit("master catalog books must be a list")

    prior = {}
    if LEDGER.exists():
        try:
            saved = json.loads(LEDGER.read_text(encoding="utf-8"))
            prior = saved.get("books", {}) if isinstance(saved, dict) else {}
        except Exception:
            prior = {}

    resolved = 0
    unresolved = 0
    methods = {}

    def resolve(book):
        key = book_key(book)
        saved = prior.get(key) if isinstance(prior, dict) else None
        saved_count = positive_int(saved.get("expected_volumes")) if isinstance(saved, dict) else None
        if saved_count:
            return key, saved_count, str(saved.get("method") or "persistent-ledger"), True
        count, method = infer_count(book)
        return key, count, method, False

    results = {}
    with ThreadPoolExecutor(max_workers=8, thread_name_prefix="volume-evidence") as pool:
        futures = {pool.submit(resolve, book): book for book in books if isinstance(book, dict)}
        for future in as_completed(futures):
            key, count, method, reused = future.result()
            if count:
                results[key] = {"expected_volumes": count, "method": method}
                resolved += 1
                methods[method] = methods.get(method, 0) + 1
            else:
                results[key] = {"expected_volumes": None, "method": method}
                unresolved += 1

    for book in books:
        if not isinstance(book, dict):
            continue
        record = results.get(book_key(book))
        if record and record.get("expected_volumes"):
            book["expected_volumes"] = record["expected_volumes"]

    data["volume_evidence"] = {
        "schema": "rechercher-volume-evidence/v1",
        "resolved": resolved,
        "unresolved": unresolved,
        "methods": methods,
        "rule": "never infer one volume without direct or source-enumeration evidence",
    }
    MASTER.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    LEDGER.write_text(
        json.dumps(
            {
                "schema": "rechercher-volume-evidence/v1",
                "books": results,
                "resolved": resolved,
                "unresolved": unresolved,
                "methods": methods,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print(f"VOLUME_EVIDENCE_RESOLVED={resolved}")
    print(f"VOLUME_EVIDENCE_UNRESOLVED={unresolved}")
    for method, count in sorted(methods.items()):
        print(f"VOLUME_EVIDENCE_METHOD {method}={count}")


if __name__ == "__main__":
    main()
