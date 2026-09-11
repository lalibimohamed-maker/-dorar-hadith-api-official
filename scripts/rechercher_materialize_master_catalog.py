#!/usr/bin/env python3
"""Materialize the single Rechercher master catalog and enrich missing sources.

Historical discovery remains metadata-only. Source discovery may attach a
candidate public PDF URL, but it never infers redistribution rights. A book is
only considered acquired after the normal PDF, identity, volume and rights
ledger gates succeed.
"""
from __future__ import annotations

import difflib
import hashlib
import json
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "books-batches/encyclopedia-master/catalog.json"
HISTORY_COMMIT = "ef5dc22c8c677e88cb26b3937a7c1fb9563164c7"
HISTORICAL = [
    "books-batches/salaf-01-400h/catalog.json",
    "books-batches/salaf-01-400h/master-discovery-additions-2026.json",
    "books-batches/salaf-01-400h/worldwide-deep-research-wave-2026-09.json",
]
IA_SEARCH = "https://archive.org/advancedsearch.php?q={query}&fl[]=identifier,title,creator,description,volume&rows=8&page=1&output=json"
IA_METADATA = "https://archive.org/metadata/{}"
USER_AGENT = "DinAllah-Encyclopedia-Rechercher/2.0"

ARABIC_MARKS = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]")

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


def norm(value):
    value = ARABIC_MARKS.sub("", str(value or "")).replace("ـ", "")
    value = value.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ى", "ي")
    value = re.sub(r"[^\w\u0600-\u06FF]+", " ", value, flags=re.UNICODE)
    return re.sub(r"\s+", " ", value).strip().casefold()


def similarity(a, b):
    na, nb = norm(a), norm(b)
    if not na or not nb:
        return 0.0
    ta, tb = set(na.split()), set(nb.split())
    overlap = len(ta & tb) / max(1, len(ta | tb))
    return max(overlap, difflib.SequenceMatcher(None, na, nb).ratio())


def http_json(url, timeout=30):
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8", "replace"))


def discover_archive_source(book):
    """Return only high-confidence IA PDF candidates; never grant rights."""
    if book.get("sources") or book.get("source_url") or book.get("url") or book.get("waqfeya_url") or book.get("archive_url"):
        return book
    title = str(book.get("title") or "").strip()
    author = str(book.get("author") or "").strip()
    if not title:
        return book
    query = quote(f'title:"{title}" AND creator:"{author}"' if author else f'title:"{title}"')
    try:
        payload = http_json(IA_SEARCH.format(query=query))
        docs = (((payload or {}).get("response") or {}).get("docs") or [])
    except Exception:
        return book
    ranked = []
    for doc in docs:
        score = similarity(title, doc.get("title"))
        creator = doc.get("creator")
        if isinstance(creator, list):
            creator = " ".join(map(str, creator))
        author_score = similarity(author, creator) if author else 1.0
        combined = 0.65 * score + 0.35 * author_score
        if score >= 0.86 and (not author or author_score >= 0.45):
            ranked.append((combined, doc))
    if not ranked:
        return book
    ranked.sort(key=lambda x: x[0], reverse=True)
    best_score, best = ranked[0]
    identifier = str(best.get("identifier") or "").strip()
    if not identifier:
        return book
    try:
        metadata = http_json(IA_METADATA.format(quote(identifier, safe="")))
    except Exception:
        return book
    files = metadata.get("files") or []
    pdfs = []
    for item in files:
        name = str(item.get("name") or "")
        lower = name.casefold()
        if not lower.endswith(".pdf") or any(x in lower for x in ("_text.pdf", "_ocr.pdf", "_bw.pdf")):
            continue
        pdfs.append(name)
    if len(pdfs) != 1:
        # Multiple PDFs may represent volumes, derivatives or supplements. Do not guess.
        return book
    pdf_name = pdfs[0]
    source = {
        "url": f"https://archive.org/download/{quote(identifier, safe='')}/{quote(pdf_name, safe='/-_.')}" ,
        "pdf_url": f"https://archive.org/download/{quote(identifier, safe='')}/{quote(pdf_name, safe='/-_.')}",
        "label": "internet-archive-source-discovery",
        "discovery": "high-confidence-title-author-match",
        "match_score": round(best_score, 4),
        "identifier": identifier,
        "rights_review_required": True,
        "discover_pdfs": False,
    }
    book = dict(book)
    book["sources"] = [source]
    book["source_discovery"] = {
        "provider": "Internet Archive",
        "identifier": identifier,
        "match_score": round(best_score, 4),
        "pdf_candidates": 1,
        "volume_inference": "single-file-candidate-only; treated as one volume only by acquisition engine after direct-PDF validation",
    }
    return book


def enrich_books(books):
    targets = [b for b in books if not (b.get("sources") or b.get("source_url") or b.get("url") or b.get("waqfeya_url") or b.get("archive_url"))]
    if not targets:
        return books
    enriched = {key(b): b for b in books}
    with ThreadPoolExecutor(max_workers=8, thread_name_prefix="rechercher-source") as pool:
        futures = {pool.submit(discover_archive_source, b): key(b) for b in targets}
        for future in as_completed(futures):
            try:
                enriched[futures[future]] = future.result()
            except Exception:
                pass
    return list(enriched.values())


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

    books = enrich_books(list(merged.values()))
    master["schema"] = "din-allah/rechercher-master-catalog/v2"
    master["catalog_id"] = "encyclopedia-unbounded-chronological"
    master["policy"] = "unbounded chronological acquisition from the Prophetic era through present and future additions; no finite book-count target"
    master["books"] = sorted(books, key=chronology)
    master["materialization"] = {
        "source_of_truth": "this file only",
        "historical_seed_recovery": "immutable git history",
        "future_source_directory": "books-batches/encyclopedia-master/sources/",
        "deduplication": "title + author + chronology",
        "rights_are_not_inferred": True,
        "real_pdf_is_required_for_acquisition": True,
        "verified_pdfs_are_never_deleted_by_catalog_cleanup": True,
        "source_discovery": "Internet Archive high-confidence title/author match; discovery never grants redistribution rights",
    }
    MASTER.write_text(json.dumps(master, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    discovered = sum(1 for b in books if b.get("source_discovery"))
    print("MASTER_CATALOG_MODE=UNBOUNDED")
    print(f"MASTER_CATALOG_RECORDS={len(books)}")
    print(f"MASTER_CATALOG_SOURCE_DISCOVERY={discovered}")
    print("MASTER_CATALOG_TARGET=NONE")
    print("MASTER_CATALOG_STOP_CONDITION=NONE")


if __name__ == "__main__":
    main()
