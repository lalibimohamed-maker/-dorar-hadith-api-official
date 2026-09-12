#!/usr/bin/env python3
"""Materialize the unbounded master catalog and run global PDF discovery.

Discovery is deliberately broader than any fixed website list. Providers are
split into acquisition-capable sources, source-page bridges, and metadata-only
indexes. Discovery never grants redistribution rights.
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
from urllib.parse import quote, unquote, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "books-batches/encyclopedia-master/catalog.json"
HISTORY_COMMIT = "ef5dc22c8c677e88cb26b3937a7c1fb9563164c7"
HISTORICAL = [
    "books-batches/salaf-01-400h/catalog.json",
    "books-batches/salaf-01-400h/master-discovery-additions-2026.json",
    "books-batches/salaf-01-400h/worldwide-deep-research-wave-2026-09.json",
]
USER_AGENT = "DinAllah-Encyclopedia-Rechercher/4.0"
ARABIC_MARKS = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]")
PDF_RE = re.compile(r"(?:\.pdf(?:\?|$)|/download/[^/?#]+/[^/?#]+\.pdf(?:\?|$))", re.I)

PROVIDER_REGISTRY = [
    {"name": "Internet Archive", "kind": "pdf", "enabled": True},
    {"name": "Waqfeya", "kind": "pdf", "enabled": True},
    {"name": "Google Books", "kind": "pdf", "enabled": True},
    {"name": "Open Library", "kind": "bridge", "enabled": True},
    {"name": "Wikimedia Commons", "kind": "pdf", "enabled": True},
    {"name": "Wikisource", "kind": "bridge", "enabled": True},
    {"name": "Library of Congress", "kind": "pdf", "enabled": True},
    {"name": "Gallica", "kind": "pdf", "enabled": True},
    {"name": "Qatar Digital Library", "kind": "pdf", "enabled": True},
    {"name": "HathiTrust", "kind": "metadata", "enabled": True},
    {"name": "WorldCat", "kind": "metadata", "enabled": True},
    {"name": "DPLA", "kind": "metadata", "enabled": True},
]


def http_json(url, timeout=30):
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8", "replace"))


def fetch_text(url, timeout=30):
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
    with urlopen(req, timeout=timeout) as response:
        return response.read().decode("utf-8", "replace")


def normalize_url(url):
    p = urlsplit(str(url))
    path = quote(unquote(p.path), safe="/%:@-._~()[]")
    return urlunsplit((p.scheme, p.netloc, path, p.query, p.fragment))


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
    return (
        str(book.get("title") or "").strip(),
        str(book.get("author") or "").strip(),
        book.get("author_death_hijri", book.get("death_hijri")),
    )


def stable_id(title, author, death):
    return "master-" + hashlib.sha256(f"{title}|{author}|{death or ''}".encode()).hexdigest()[:20]


def as_book(entry, source):
    title = str(entry.get("title") or "").strip()
    if not title:
        return None
    book = dict(entry)
    book["id"] = book.get("id") or stable_id(
        title, str(book.get("author") or ""), book.get("author_death_hijri", book.get("death_hijri"))
    )
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


def ranked_pdf(url, provider, discovery, score, *, source_page=None, discover_pdfs=False, **extra):
    item = {
        "url": normalize_url(source_page or url),
        "pdf_url": normalize_url(url),
        "label": f"{provider.lower().replace(' ', '-')}-global-discovery",
        "provider": provider,
        "discovery": discovery,
        "match_score": round(float(score), 4),
        "rights_review_required": True,
        "discover_pdfs": bool(discover_pdfs),
    }
    item.update(extra)
    return item


def archive_candidates(title, author):
    queries = [
        f'title:"{title}" AND creator:"{author}"' if author else f'title:"{title}"',
        f'"{title}" AND creator:"{author}"' if author else f'"{title}"',
        f'title:{title}',
    ]
    results, seen_ids = [], set()
    for raw in queries:
        try:
            payload = http_json(f"https://archive.org/advancedsearch.php?q={quote(raw)}&fl[]=identifier,title,creator,description,volume&rows=20&page=1&output=json")
        except Exception:
            continue
        for doc in (((payload or {}).get("response") or {}).get("docs") or []):
            identifier = str(doc.get("identifier") or "").strip()
            if not identifier or identifier in seen_ids:
                continue
            creator = doc.get("creator")
            creator = " ".join(map(str, creator)) if isinstance(creator, list) else creator
            ts, au = similarity(title, doc.get("title")), similarity(author, creator) if author else 1.0
            score = 0.65 * ts + 0.35 * au
            if ts < 0.72 or (author and au < 0.30):
                continue
            seen_ids.add(identifier)
            try:
                meta = http_json(f"https://archive.org/metadata/{quote(identifier, safe='')}")
            except Exception:
                continue
            for item in meta.get("files") or []:
                name = str(item.get("name") or "")
                lower = name.casefold()
                if not lower.endswith(".pdf") or any(x in lower for x in ("_text.pdf", "_ocr.pdf", "_bw.pdf")):
                    continue
                pdf = f"https://archive.org/download/{quote(identifier, safe='')}/{quote(name, safe='/-_.()[]%') }"
                results.append(ranked_pdf(pdf, "Internet Archive", "title-author-ranked-search", score, identifier=identifier))
    return sorted(results, key=lambda x: (-x["match_score"], x["pdf_url"]))[:32]


def waqfeya_candidates(title, author):
    try:
        page = fetch_text(f"https://waqfeya.net/search.php?field=title&getword={quote(title)}&st=0")
    except Exception:
        return []
    links = []
    for match in re.finditer(r'href=["\']([^"\']*/books/[^"\']+)["\']', page, re.I):
        link = normalize_url(urljoin("https://waqfeya.net/", html.unescape(match.group(1))))
        if link not in links:
            links.append(link)
    ranked = []
    for link in links[:40]:
        try:
            book_page = fetch_text(link)
        except Exception:
            continue
        m = re.search(r'<h1[^>]*>(.*?)</h1>', book_page, re.I | re.S)
        page_title = re.sub(r"<[^>]+>", " ", html.unescape(m.group(1))) if m else link
        score = similarity(title, page_title)
        if score < 0.62 or (author and similarity(author, book_page) < 0.20):
            continue
        for pdf in pdf_links(book_page, link)[:32]:
            ranked.append(ranked_pdf(pdf, "Waqfeya", "title-ranked-book-page", score, source_page=link))
    return sorted(ranked, key=lambda x: (-x["match_score"], x["pdf_url"]))[:32]


def google_books_candidates(title, author):
    query = quote(f'intitle:{title} inauthor:{author}' if author else f'intitle:{title}')
    try:
        payload = http_json(f"https://www.googleapis.com/books/v1/volumes?q={query}&maxResults=20")
    except Exception:
        return []
    out = []
    for item in payload.get("items") or []:
        info, access = item.get("volumeInfo") or {}, item.get("accessInfo") or {}
        score = similarity(title, info.get("title"))
        if score < 0.72:
            continue
        pdf = access.get("pdf") or {}
        link = pdf.get("downloadLink") or pdf.get("acsTokenLink")
        if link:
            out.append(ranked_pdf(link, "Google Books", "accessInfo.pdf", score))
    return out[:20]


def openlibrary_candidates(title, author):
    query = quote(f'title:"{title}" author:"{author}"' if author else f'title:"{title}"')
    try:
        payload = http_json(f"https://openlibrary.org/search.json?q={query}&limit=20")
    except Exception:
        return []
    out = []
    for doc in payload.get("docs") or []:
        score = similarity(title, doc.get("title"))
        if score < 0.72:
            continue
        for identifier in doc.get("ia") or []:
            identifier = str(identifier).strip()
            if not identifier:
                continue
            out.append({
                "url": f"https://archive.org/details/{quote(identifier, safe='')}",
                "label": "open-library-global-discovery",
                "provider": "Open Library",
                "discovery": "Open Library Internet Archive bridge",
                "match_score": round(score, 4),
                "rights_review_required": True,
                "discover_pdfs": True,
                "identifier": identifier,
            })
    return out[:20]


def wikimedia_candidates(title, author):
    q = quote(" ".join(x for x in (title, author) if x))
    api = f"https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch={q}&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=0&format=json"
    try:
        payload = http_json(api)
    except Exception:
        return []
    out = []
    for page in ((payload.get("query") or {}).get("pages") or {}).values():
        info = (page.get("imageinfo") or [{}])[0]
        direct = info.get("url")
        if not direct:
            continue
        score = similarity(title, page.get("title"))
        if score < 0.55:
            continue
        if str(direct).casefold().endswith(".pdf"):
            out.append(ranked_pdf(direct, "Wikimedia Commons", "Commons file search", score, source_page=f"https://commons.wikimedia.org/wiki/{quote(str(page.get('title') or ''), safe=':()') }"))
    return out[:20]


def wikisource_candidates(title, author):
    q = quote(" ".join(x for x in (title, author) if x))
    api = f"https://ar.wikisource.org/w/api.php?action=query&list=search&srsearch={q}&srnamespace=0&srlimit=10&format=json"
    try:
        payload = http_json(api)
    except Exception:
        return []
    out = []
    for row in ((payload.get("query") or {}).get("search") or []):
        page_title = row.get("title")
        if not page_title:
            continue
        score = similarity(title, page_title)
        if score < 0.60:
            continue
        out.append({
            "url": f"https://ar.wikisource.org/wiki/{quote(str(page_title).replace(' ', '_'), safe=':_()')}",
            "label": "wikisource-global-discovery",
            "provider": "Wikisource",
            "discovery": "Arabic Wikisource title search",
            "match_score": round(score, 4),
            "rights_review_required": True,
            "discover_pdfs": True,
        })
    return out[:10]


def loc_candidates(title, author):
    q = quote(" ".join(x for x in (title, author) if x))
    try:
        payload = http_json(f"https://www.loc.gov/books/?q={q}&fo=json&c=25")
    except Exception:
        return []
    out = []
    for item in payload.get("results") or []:
        score = similarity(title, item.get("title"))
        if score < 0.62:
            continue
        for resource in item.get("resources") or []:
            url = resource.get("url") or resource.get("download_url")
            if url and PDF_RE.search(str(url)):
                out.append(ranked_pdf(str(url), "Library of Congress", "LOC books API PDF resource", score, source_page=item.get("id")))
    return out[:20]


def html_repository_candidates(provider, search_url, title, author, score_floor=0.60):
    try:
        page = fetch_text(search_url)
    except Exception:
        return []
    out = []
    for pdf in pdf_links(page, search_url)[:32]:
        score = similarity(title, page[:12000])
        if score >= score_floor:
            out.append(ranked_pdf(pdf, provider, "repository search-page PDF extraction", score, source_page=search_url))
    return out


def gallica_candidates(title, author):
    search = f"https://gallica.bnf.fr/services/engine/search/sru?operation=searchRetrieve&version=1.2&query={quote(title)}&maximumRecords=20&collapsing=true&format=json"
    try:
        payload = http_json(search)
    except Exception:
        return []
    out = []
    records = ((payload.get("srw") or {}).get("result") or [])
    for record in records:
        data = record.get("recordData") or {}
        links = []
        if isinstance(data, dict):
            for value in data.values():
                if isinstance(value, str) and (".pdf" in value.lower()):
                    links.append(value)
        for link in links:
            out.append(ranked_pdf(link, "Gallica", "BnF SRU record PDF link", similarity(title, record.get("recordTitle"))))
    return out[:20]


def qdl_candidates(title, author):
    url = f"https://www.qdl.qa/en/search/site/{quote(title)}"
    return html_repository_candidates("Qatar Digital Library", url, title, author, 0.45)


def metadata_evidence(provider, url, title):
    return {
        "provider": provider,
        "url": normalize_url(url),
        "title_match_score": round(similarity(title, title), 4),
        "metadata_only": True,
        "rights_grant": False,
    }


def metadata_candidates(title, author):
    q = quote(" ".join(x for x in (title, author) if x))
    return [
        metadata_evidence("HathiTrust", f"https://catalog.hathitrust.org/Search/Home?lookfor={q}&type=all", title),
        metadata_evidence("WorldCat", f"https://search.worldcat.org/search?q={q}", title),
        metadata_evidence("DPLA", f"https://dp.la/search?q={q}", title),
    ]


def provider_calls(title, author):
    return [
        ("Internet Archive", archive_candidates),
        ("Waqfeya", waqfeya_candidates),
        ("Google Books", google_books_candidates),
        ("Open Library", openlibrary_candidates),
        ("Wikimedia Commons", wikimedia_candidates),
        ("Wikisource", wikisource_candidates),
        ("Library of Congress", loc_candidates),
        ("Gallica", gallica_candidates),
        ("Qatar Digital Library", qdl_candidates),
        ("HathiTrust", lambda t, a: []),
        ("WorldCat", lambda t, a: []),
        ("DPLA", lambda t, a: []),
    ]


def discover_sources(book):
    book = normalize_legacy_sources(book)
    if book.get("sources"):
        return book
    title = str(book.get("title") or "").strip()
    author = str(book.get("author") or "").strip()
    if not title:
        return book
    additions, attempted, failures = [], [], []
    metadata = metadata_candidates(title, author)
    with ThreadPoolExecutor(max_workers=8, thread_name_prefix="rechercher-provider") as pool:
        futures = {pool.submit(worker, title, author): provider for provider, worker in provider_calls(title, author) if provider not in {"HathiTrust", "WorldCat", "DPLA"}}
        for future in as_completed(futures):
            provider = futures[future]
            attempted.append(provider)
            try:
                additions.extend(future.result())
            except Exception as exc:
                failures.append({"provider": provider, "error": str(exc)[:240]})
    sources = merge_sources(book.get("sources"), additions)
    result = dict(book)
    if sources:
        result["sources"] = sources
    result["discovery_evidence"] = {
        "attempted_providers": sorted(set(attempted)),
        "metadata_providers": metadata,
        "source_candidate_count": len(sources),
        "direct_pdf_candidate_count": sum(1 for x in sources if x.get("pdf_url")),
        "failures": failures,
        "provider_registry_version": "global-worldwide-pdf-v2",
        "rights_inference": "forbidden",
        "redistribution_rights_granted": False,
    }
    if not sources:
        result["source_discovery"] = {
            "attempted": True,
            "providers": sorted(set(attempted) | {m["provider"] for m in metadata}),
            "candidate_count": 0,
            "status": "no-pdf-candidate-found",
            "discovery_version": "global-worldwide-pdf-v2",
        }
    else:
        result["source_discovery"] = {
            "attempted": True,
            "providers": sorted({str(x.get("provider") or x.get("label")) for x in sources}),
            "candidate_count": len(sources),
            "discovery_version": "global-worldwide-pdf-v2",
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
            k = futures[future]
            try:
                enriched[k] = future.result()
            except Exception as exc:
                b = enriched[k]
                b["source_discovery"] = {
                    "attempted": True,
                    "status": "discovery-error",
                    "error": str(exc)[:240],
                    "discovery_version": "global-worldwide-pdf-v2",
                }
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
    master["policy"] = "unbounded chronological acquisition; no finite book-count target"
    master["books"] = sorted(books, key=chronology)
    master["materialization"] = {
        "source_of_truth": "this file only",
        "historical_seed_recovery": "immutable git history",
        "future_source_directory": "books-batches/encyclopedia-master/sources/",
        "deduplication": "title + author + chronology",
        "rights_are_not_inferred": True,
        "real_pdf_is_required_for_acquisition": True,
        "verified_pdfs_are_never_deleted_by_catalog_cleanup": True,
        "source_discovery": "global worldwide PDF discovery v2",
        "provider_registry_version": "global-worldwide-pdf-v2",
        "providers": [x["name"] for x in PROVIDER_REGISTRY if x["enabled"]],
        "provider_kinds": {x["name"]: x["kind"] for x in PROVIDER_REGISTRY if x["enabled"]},
        "metadata_providers_never_grant_rights": True,
        "legacy_url_normalization": "source_url/url/waqfeya/archive/openlibrary URLs are promoted before acquisition",
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
    print("MASTER_CATALOG_PROVIDER_REGISTRY=global-worldwide-pdf-v2")
    print(f"MASTER_CATALOG_PROVIDERS={','.join(x['name'] for x in PROVIDER_REGISTRY if x['enabled'])}")
    print("MASTER_CATALOG_TARGET=NONE")
    print("MASTER_CATALOG_STOP_CONDITION=NONE")


if __name__ == "__main__":
    main()
