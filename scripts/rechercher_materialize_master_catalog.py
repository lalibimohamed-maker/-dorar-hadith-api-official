#!/usr/bin/env python3
"""Materialize the master catalog and persist global PDF-source discovery.

Discovery never grants redistribution rights. Only real PDF/download candidates
are promoted to acquisition sources; metadata-only providers remain evidence.
"""
from __future__ import annotations

import difflib
import hashlib
import html
import json
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import quote, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "books-batches/encyclopedia-master/catalog.json"
HISTORY_COMMIT = "ef5dc22c8c677e88cb26b3937a7c1fb9563164c7"
HISTORICAL = [
    "books-batches/salaf-01-400h/catalog.json",
    "books-batches/salaf-01-400h/master-discovery-additions-2026.json",
    "books-batches/salaf-01-400h/worldwide-deep-research-wave-2026-09.json",
]
IA_SEARCH = "https://archive.org/advancedsearch.php?q={query}&fl[]=identifier,title,creator,description,volume&rows=12&page=1&output=json"
IA_METADATA = "https://archive.org/metadata/{}"
WAQFEYA_SEARCH = "https://waqfeya.net/search.php?field=title&getword={query}&st=0"
GOOGLE_BOOKS = "https://www.googleapis.com/books/v1/volumes?q={query}&maxResults=10"
OPENLIBRARY = "https://openlibrary.org/search.json?q={query}&limit=10"
USER_AGENT = "DinAllah-Encyclopedia-Rechercher/3.0"
ARABIC_MARKS = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]")
PDF_RE = re.compile(r"\.pdf(?:\?|$)", re.I)


def http_json(url, timeout=30):
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8", "replace"))


def fetch_text(url, timeout=30):
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=timeout) as response:
        return response.read().decode("utf-8", "replace")


def normalize_url(url):
    p = urlsplit(str(url))
    return urlunsplit((p.scheme, p.netloc, quote(p.path, safe="/%:@-._~"), p.query, p.fragment))


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


def key(book):
    return (str(book.get("title") or "").strip(), str(book.get("author") or "").strip(), book.get("author_death_hijri", book.get("death_hijri")))


def stable_id(title, author, death):
    return "master-" + hashlib.sha256(f"{title}|{author}|{death or ''}".encode()).hexdigest()[:20]


def as_book(entry, source):
    title = str(entry.get("title") or "").strip()
    if not title:
        return None
    book = dict(entry)
    book["id"] = book.get("id") or stable_id(title, str(book.get("author") or ""), book.get("author_death_hijri", book.get("death_hijri")))
    book["source_registry"] = source
    book.setdefault("rights_status", "discovery-only")
    return book


def source_entries(data, source):
    out = []
    if not isinstance(data, dict):
        return out
    for field in ("books", "entries"):
        for item in data.get(field) or []:
            if isinstance(item, dict):
                book = as_book(item, source)
                if book:
                    out.append(book)
    return out


def git_history_json(path):
    try:
        return json.loads(subprocess.check_output(["git", "show", f"{HISTORY_COMMIT}:{path}"], cwd=ROOT, text=True))
    except Exception:
        return None


def normalize_legacy_sources(book):
    if isinstance(book.get("sources"), list) and book.get("sources"):
        return dict(book)
    result = dict(book)
    candidates = []
    for field in ("source_url", "url", "waqfeya_url", "archive_url", "internet_archive_url", "openlibrary_url"):
        if result.get(field):
            candidates.append({"url": str(result[field]), "label": field, "discover_pdfs": True})
    if candidates:
        result["sources"] = candidates
    return result


def merge_sources(existing, additions):
    merged = list(existing or []) if isinstance(existing, list) else []
    seen = {normalize_url(x.get("url")) for x in merged if isinstance(x, dict) and x.get("url")}
    for item in additions:
        if not item.get("url"):
            continue
        url = normalize_url(item["url"])
        if url not in seen:
            item = dict(item)
            item["url"] = url
            merged.append(item)
            seen.add(url)
    return merged


def pdf_links(page, base):
    out, seen = [], set()
    for match in re.finditer(r'href=["\']([^"\']+)["\']', page, re.I):
        url = normalize_url(urljoin(base, html.unescape(match.group(1))))
        if PDF_RE.search(url) and not re.search(r"\.pdf\.enc(?:\?|$)", url, re.I) and url not in seen:
            seen.add(url)
            out.append(url)
    return out


def archive_candidates(title, author):
    queries = [
        f'title:"{title}" AND creator:"{author}"' if author else f'title:"{title}"',
        f'"{title}" AND creator:"{author}"' if author else f'"{title}"',
        f'title:{title}'
    ]
    results = []
    seen_ids = set()
    for raw in queries:
        try:
            payload = http_json(IA_SEARCH.format(query=quote(raw)))
        except Exception:
            continue
        for doc in (((payload or {}).get("response") or {}).get("docs") or []):
            identifier = str(doc.get("identifier") or "").strip()
            if not identifier or identifier in seen_ids:
                continue
            creator = doc.get("creator")
            if isinstance(creator, list):
                creator = " ".join(map(str, creator))
            ts = similarity(title, doc.get("title"))
            au = similarity(author, creator) if author else 1.0
            score = 0.65 * ts + 0.35 * au
            if ts >= 0.78 and (not author or au >= 0.35):
                seen_ids.add(identifier)
                try:
                    meta = http_json(IA_METADATA.format(quote(identifier, safe="")))
                    files = meta.get("files") or []
                except Exception:
                    continue
                pdfs = []
                for item in files:
                    name = str(item.get("name") or "")
                    lower = name.casefold()
                    if lower.endswith(".pdf") and not any(x in lower for x in ("_text.pdf", "_ocr.pdf", "_bw.pdf")):
                        pdfs.append(name)
                for pdf_name in pdfs[:24]:
                    results.append({
                        "url": f"https://archive.org/download/{quote(identifier, safe='')}/{quote(pdf_name, safe='/-_.')}",
                        "pdf_url": f"https://archive.org/download/{quote(identifier, safe='')}/{quote(pdf_name, safe='/-_.')}",
                        "label": "internet-archive-global-discovery",
                        "provider": "Internet Archive",
                        "discovery": "title-author-ranked-search",
                        "match_score": round(score, 4),
                        "identifier": identifier,
                        "rights_review_required": True,
                        "discover_pdfs": False,
                    })
    results.sort(key=lambda x: (-x.get("match_score", 0), x["url"]))
    return results[:24]


def waqfeya_candidates(title, author):
    try:
        page = fetch_text(WAQFEYA_SEARCH.format(query=quote(title)))
    except Exception:
        return []
    links = []
    for match in re.finditer(r'href=["\']([^"\']*/books/[^"\']+)["\']', page, re.I):
        link = normalize_url(urljoin("https://waqfeya.net/", html.unescape(match.group(1))))
        if link not in links:
            links.append(link)
    ranked = []
    for link in links[:30]:
        try:
            book_page = fetch_text(link)
        except Exception:
            continue
        page_title = ""
        m = re.search(r'<h1[^>]*>(.*?)</h1>', book_page, re.I | re.S)
        if m:
            page_title = re.sub(r"<[^>]+>", " ", html.unescape(m.group(1)))
        score = similarity(title, page_title or link)
        if score < 0.65:
            continue
        pdfs = pdf_links(book_page, link)
        for pdf in pdfs[:24]:
            ranked.append({
                "url": link,
                "pdf_url": pdf,
                "label": "waqfeya-global-discovery",
                "provider": "Waqfeya",
                "discovery": "title-ranked-book-page",
                "match_score": round(score, 4),
                "rights_review_required": True,
                "discover_pdfs": False,
            })
    ranked.sort(key=lambda x: (-x.get("match_score", 0), x["pdf_url"]))
    return ranked[:24]


def google_books_candidates(title, author):
    query = quote(f'intitle:{title} inauthor:{author}' if author else f'intitle:{title}')
    try:
        payload = http_json(GOOGLE_BOOKS.format(query=query))
    except Exception:
        return []
    out = []
    for item in (payload.get("items") or [])[:10]:
        info = item.get("volumeInfo") or {}
        access = item.get("accessInfo") or {}
        score = similarity(title, info.get("title"))
        if score < 0.75:
            continue
        pdf = access.get("pdf") or {}
        link = pdf.get("downloadLink") or pdf.get("acsTokenLink")
        if link:
            out.append({"url": link, "pdf_url": link, "label": "google-books-pdf-discovery", "provider": "Google Books", "discovery": "accessInfo.pdf", "match_score": round(score, 4), "rights_review_required": True, "discover_pdfs": False})
    return out


def openlibrary_candidates(title, author):
    query = quote(f'title:"{title}" author:"{author}"' if author else f'title:"{title}"')
    try:
        payload = http_json(OPENLIBRARY.format(query=query))
    except Exception:
        return []
    out = []
    for doc in (payload.get("docs") or [])[:10]:
        score = similarity(title, doc.get("title"))
        if score < 0.78:
            continue
        for ia in doc.get("ia") or []:
            identifier = str(ia).strip()
            if identifier:
                out.append({
                    "url": f"https://archive.org/details/{quote(identifier, safe='')}",
                    "label": "openlibrary-to-archive-discovery",
                    "provider": "Open Library",
                    "discovery": "OpenLibrary IA identifier; PDF enumeration delegated to source page",
                    "match_score": round(score, 4),
                    "rights_review_required": True,
                    "discover_pdfs": True,
                })
    return out


def discover_sources(book):
    book = normalize_legacy_sources(book)
    if book.get("sources"):
        return book
    title = str(book.get("title") or "").strip()
    author = str(book.get("author") or "").strip()
    if not title:
        return book
    candidates = []
    # Real-PDF-capable providers first; metadata providers may bridge to IA.
    for worker in (
        lambda: archive_candidates(title, author),
        lambda: waqfeya_candidates(title, author),
        lambda: google_books_candidates(title, author),
        lambda: openlibrary_candidates(title, author),
    ):
        try:
            candidates.extend(worker())
        except Exception:
            continue
    sources = merge_sources(book.get("sources"), candidates)
    result = dict(book)
    if sources:
        result["sources"] = sources
        result["source_discovery"] = {
            "attempted": True,
            "providers": sorted({str(x.get("provider") or x.get("label")) for x in sources}),
            "candidate_count": len(sources),
            "discovery_version": "global-pdf-v1",
        }
    else:
        result["source_discovery"] = {
            "attempted": True,
            "providers": ["Internet Archive", "Waqfeya", "Google Books", "Open Library"],
            "candidate_count": 0,
            "status": "no-pdf-candidate-found",
            "discovery_version": "global-pdf-v1",
        }
    return result


def enrich_books(books):
    normalized = [normalize_legacy_sources(b) for b in books]
    targets = [b for b in normalized if not b.get("sources")]
    if not targets:
        return normalized
    enriched = {key(b): b for b in normalized}
    with ThreadPoolExecutor(max_workers=8, thread_name_prefix="rechercher-global-source") as pool:
        futures = {pool.submit(discover_sources, b): key(b) for b in targets}
        for future in as_completed(futures):
            try:
                enriched[futures[future]] = future.result()
            except Exception as exc:
                b = enriched[futures[future]]
                b["source_discovery"] = {"attempted": True, "status": "discovery-error", "error": str(exc), "discovery_version": "global-pdf-v1"}
    return list(enriched.values())


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
    merged = {key(b): b for b in (master.get("books") or []) if isinstance(b, dict)}
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
        "source_discovery": "global multi-source PDF discovery v1",
        "providers": ["Internet Archive", "Waqfeya", "Google Books", "Open Library"],
        "metadata_providers_never_grant_rights": True,
        "legacy_url_normalization": "source_url/url/waqfeya/archive URLs are promoted into sources before acquisition",
    }
    MASTER.write_text(json.dumps(master, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    discovered = sum(1 for b in books if b.get("source_discovery", {}).get("candidate_count", 0) > 0)
    with_sources = sum(1 for b in books if b.get("sources"))
    no_source = sum(1 for b in books if b.get("source_discovery", {}).get("candidate_count", 0) == 0)
    print("MASTER_CATALOG_MODE=UNBOUNDED")
    print(f"MASTER_CATALOG_RECORDS={len(books)}")
    print(f"MASTER_CATALOG_WITH_SOURCES={with_sources}")
    print(f"MASTER_CATALOG_SOURCE_DISCOVERY={discovered}")
    print(f"MASTER_CATALOG_NO_SOURCE_AFTER_GLOBAL_DISCOVERY={no_source}")
    print("MASTER_CATALOG_TARGET=NONE")
    print("MASTER_CATALOG_STOP_CONDITION=NONE")


if __name__ == "__main__":
    main()
