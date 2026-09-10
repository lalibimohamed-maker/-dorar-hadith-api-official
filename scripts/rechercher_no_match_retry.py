#!/usr/bin/env python3
"""Bounded worldwide retry for unresolved PDF acquisitions.

The retry engine is deliberately incremental: every book has a wall-clock
budget, every run has a book cap, candidate breadth is bounded, and state is
checkpointed after each book. A copy is an acquisition only after %PDF-,
qpdf --check, and SHA-256 validation. Rights/publication remain separate.
"""
import argparse, hashlib, html, json, re, subprocess, time
from pathlib import Path
from urllib.parse import quote, urlencode, urljoin
from urllib.request import Request, urlopen

UA = "DinAllah-Encyclopedia/rechercher-deep-worldwide/4.0"
TIMEOUT = 12
BOOK_BUDGET_SECONDS = 120
MAX_CANDIDATES = 36
MAX_PAGE_PDFS = 4
MAX_BOOKS_DEFAULT = 8


def fetch(url, deadline=None):
    if deadline is not None:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("book_budget_exhausted")
        timeout = min(TIMEOUT, max(1, int(remaining)))
    else:
        timeout = TIMEOUT
    req = Request(url, headers={"User-Agent": UA,
        "Accept": "application/json,text/html,application/xhtml+xml,application/pdf,*/*"})
    with urlopen(req, timeout=timeout) as r:
        return r.read(), (r.headers.get("Content-Type") or "").lower(), r.geturl()


def get_json(url, deadline=None):
    data, _, _ = fetch(url, deadline)
    return json.loads(data.decode("utf-8", "replace"))


def sha(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def valid(path):
    if path.read_bytes()[:5] != b"%PDF-":
        return False, "invalid_pdf_signature"
    r = subprocess.run(["qpdf", "--check", str(path)], text=True, capture_output=True, timeout=30)
    msg = (r.stdout + r.stderr).strip()
    if r.returncode != 0:
        return False, msg or "qpdf_check_failed"
    if re.search(r"warning|error", msg, re.I):
        return False, msg
    return True, msg


def norm(value): return " ".join(str(value or "").split()).strip()

def terms(book): return [x for x in (norm(book.get("title")), norm(book.get("author"))) if x]

def query_variants(book):
    title, author = norm(book.get("title")), norm(book.get("author")); out = []
    if title and author: out += [f"{title} {author}", f'"{title}" {author}']
    if title: out.append(title)
    if author: out.append(author)
    return list(dict.fromkeys(x for x in out if x))


def archive_candidates(book, deadline):
    title, author = norm(book.get("title")), norm(book.get("author")); queries = []
    if title and author: queries.append(f'title:"{title}" AND creator:"{author}"')
    if title: queries.append(f'title:"{title}"')
    if author: queries.append(f'creator:"{author}"')
    out = []
    for q in list(dict.fromkeys(queries)):
        data = get_json("https://archive.org/advancedsearch.php?" + urlencode({"q": q, "fl[]": "identifier", "rows": 8, "page": 1, "output": "json"}), deadline)
        for doc in data.get("response", {}).get("docs", [])[:8]:
            ident = doc.get("identifier")
            if not ident: continue
            meta = get_json("https://archive.org/metadata/" + quote(ident, safe=""), deadline)
            files = []
            for f in meta.get("files", []):
                name = f.get("name", "")
                if name.lower().endswith(".pdf") and not re.search(r"_(text|scandata)\.pdf$", name, re.I):
                    files.append((int(f.get("size") or 0), name))
            for _, name in sorted(files, reverse=True)[:3]:
                out.append("https://archive.org/download/" + quote(ident, safe="") + "/" + quote(name, safe=""))
    return list(dict.fromkeys(out))


def open_library_candidates(book, deadline):
    out = []
    for q in query_variants(book)[:3]:
        data = get_json("https://openlibrary.org/search.json?" + urlencode({"q": q, "fields": "*,availability", "limit": 10, "lang": "ara"}), deadline)
        for doc in data.get("docs", []):
            for ident in (doc.get("ia") or [])[:3]:
                if ident: out.append("https://archive.org/download/" + quote(ident, safe=""))
    return list(dict.fromkeys(out))


def loc_candidates(book, deadline):
    out = []
    for q in query_variants(book)[:2]:
        data = get_json("https://www.loc.gov/books/?" + urlencode({"q": q, "fo": "json", "c": 10}), deadline)
        for item in data.get("results", [])[:10]:
            if item.get("id"): out.append(item["id"])
            for resource in (item.get("resources") or [])[:4]:
                for key in ("url", "pdf", "file"):
                    if resource.get(key): out.append(resource[key])
    return list(dict.fromkeys(x for x in out if isinstance(x, str)))


def google_books_candidates(book, deadline):
    out = []
    for q in query_variants(book)[:2]:
        data = get_json("https://www.googleapis.com/books/v1/volumes?" + urlencode({"q": q, "maxResults": 10, "printType": "books"}), deadline)
        for item in data.get("items", [])[:10]:
            vi, acc = item.get("volumeInfo") or {}, item.get("accessInfo") or {}
            for key in ("webReaderLink", "infoLink", "canonicalVolumeLink"):
                if vi.get(key): out.append(vi[key])
            pdf = acc.get("pdf") or {}
            if pdf.get("downloadLink"): out.append(pdf["downloadLink"])
    return list(dict.fromkeys(out))


def crossref_candidates(book, deadline):
    out = []
    for q in query_variants(book)[:1]:
        data = get_json("https://api.crossref.org/works?" + urlencode({"query.bibliographic": q, "rows": 3}), deadline)
        for item in data.get("message", {}).get("items", [])[:3]:
            for link in item.get("link", [])[:3]:
                if link.get("URL"): out.append(link["URL"])
            if item.get("URL"): out.append(item["URL"])
    return list(dict.fromkeys(out))


def openiti_kitab_candidates(book, deadline):
    title = norm(book.get("title"))
    if not title: return []
    q = quote(" ".join(terms(book)))
    return ["https://github.com/OpenITI/RELEASE/tree/master/" + q,
            "https://www.google.com/search?q=" + quote("site:kitab-project.org " + title)]


def arabic_index_candidates(book, deadline):
    title = norm(book.get("title"))
    if not title: return []
    return ["https://waqfeya.net/search?" + urlencode({"q": title}),
            "https://www.almeshkat.net/search.php?" + urlencode({"q": title}),
            "https://arabicpdfs.com/?s=" + quote(title)]


def mediawiki_candidates(api, book, deadline):
    out = []
    for query in query_variants(book)[:2]:
        data = get_json(api + "?" + urlencode({"action": "query", "generator": "search", "gsrsearch": query, "gsrnamespace": 6, "gsrlimit": 20, "prop": "imageinfo", "iiprop": "url", "format": "json"}), deadline)
        for page in (data.get("query", {}).get("pages", {}) or {}).values():
            for info in (page.get("imageinfo") or [])[:2]:
                if info.get("url"): out.append(info["url"])
    return list(dict.fromkeys(out))


def page_pdf_candidates(url, deadline):
    data, ctype, final = fetch(url, deadline)
    if data[:5] == b"%PDF-": return [final]
    text = data.decode("utf-8", "replace"); out = []
    patterns = [r'href=["\']([^"\']+)["\']', r'"(?:download|pdf|file|url)"\s*:\s*"([^"]+\.pdf(?:\?[^"\\]*)?)"']
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.I):
            u = urljoin(final, html.unescape(match.group(1)).replace("\\/", "/"))
            if re.search(r"\.pdf(?:\?|$)", u, re.I) and not re.search(r"\.pdf\.enc(?:\?|$)", u, re.I):
                out.append(u)
                if len(out) >= MAX_PAGE_PDFS: return list(dict.fromkeys(out))
    if "archive.org/details/" in final:
        ident = final.rstrip("/").split("/")[-1]
        meta = get_json("https://archive.org/metadata/" + quote(ident, safe=""), deadline)
        for f in meta.get("files", []):
            name = f.get("name", "")
            if name.lower().endswith(".pdf") and not re.search(r"_(text|scandata)\.pdf$", name, re.I):
                out.append("https://archive.org/download/" + quote(ident, safe="") + "/" + quote(name, safe=""))
                if len(out) >= MAX_PAGE_PDFS: break
    return list(dict.fromkeys(out))


def saved_source_candidates(rec):
    out = []
    for key in ("source_urls", "saved_sources", "discovery_sources", "sources"):
        value = rec.get(key) or []
        if isinstance(value, str): value = [value]
        for item in value:
            if isinstance(item, str): out.append(item)
            elif isinstance(item, dict):
                for key2 in ("url", "download_url", "pdf_url", "source_url"):
                    if item.get(key2): out.append(item[key2]); break
    for item in rec.get("candidates") or []:
        if isinstance(item, dict) and item.get("url"): out.append(item["url"])
    return list(dict.fromkeys(u for u in out if isinstance(u, str) and u.startswith(("http://", "https://"))))


def candidates(rec, deadline):
    out = [("saved_sources", u) for u in saved_source_candidates(rec)]
    funcs = [("internet_archive", archive_candidates), ("open_library", open_library_candidates),
             ("library_of_congress", loc_candidates), ("google_books", google_books_candidates),
             ("crossref", crossref_candidates), ("openiti_kitab", openiti_kitab_candidates),
             ("arabic_indexes", arabic_index_candidates),
             ("wikimedia_commons", lambda b, d: mediawiki_candidates("https://commons.wikimedia.org/w/api.php", b, d)),
             ("wikisource", lambda b, d: mediawiki_candidates("https://ar.wikisource.org/w/api.php", b, d))]
    for engine, fn in funcs:
        if time.monotonic() >= deadline: raise TimeoutError("book_budget_exhausted")
        try:
            for url in fn(rec, deadline):
                out.append((engine, url))
                if len(out) >= MAX_CANDIDATES: return list(dict.fromkeys(out))[:MAX_CANDIDATES]
        except TimeoutError: raise
        except Exception: continue
    return list(dict.fromkeys(out))[:MAX_CANDIDATES]


def checkpoint(data, manifest_path, stats, report_path):
    counts = data.setdefault("counts", {})
    counts["acquired_books"] = sum(r.get("availability") == "copy-acquired" for r in data.get("records", []))
    counts["acquired_files"] = sum(int(r.get("acquired_count", 0)) for r in data.get("records", []))
    counts["global_search_no_match"] = sum(r.get("acquisition_state") == "global-search-no-match" for r in data.get("records", []))
    data["schema"] = "developer-review-acquisition/v8"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = manifest_path.with_suffix(manifest_path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"); tmp.replace(manifest_path)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(stats, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    p = argparse.ArgumentParser(); p.add_argument("--manifest", required=True); p.add_argument("--vault", required=True); p.add_argument("--report", required=True); p.add_argument("--max-books", type=int, default=MAX_BOOKS_DEFAULT)
    a = p.parse_args(); mp, vault, report = Path(a.manifest), Path(a.vault), Path(a.report)
    data = json.loads(mp.read_text(encoding="utf-8")); records = data.get("records", [])
    gaps = [r for r in records if r.get("acquisition_state") == "global-search-no-match"]
    if a.max_books > 0: gaps = gaps[:a.max_books]
    stats = {"schema": "rechercher-deep-worldwide/v4", "input_gaps": len(gaps), "new_acquired_books": 0, "new_acquired_files": 0, "invalid_candidates": 0, "errors": 0, "timed_out": 0, "source_attempts": {}, "gaps": []}
    for rec in gaps:
        deadline = time.monotonic() + BOOK_BUDGET_SECONDS
        gap = {"id": rec.get("id"), "title": rec.get("title"), "author": rec.get("author"), "attempts": [], "result": "no-match"}
        acquired = list(rec.get("acquired") or []); found = []; seen = set()
        try:
            for engine, url in candidates(rec, deadline):
                if time.monotonic() >= deadline: raise TimeoutError("book_budget_exhausted")
                if url in seen: continue
                seen.add(url); stats["source_attempts"][engine] = stats["source_attempts"].get(engine, 0) + 1
                attempt = {"engine": engine, "url": url, "result": "no-pdf"}
                try:
                    for pdf in page_pdf_candidates(url, deadline)[:MAX_PAGE_PDFS]:
                        if acquired or found: break
                        if time.monotonic() >= deadline: raise TimeoutError("book_budget_exhausted")
                        path = vault / (rec["id"] + "--deep-" + hashlib.sha256(pdf.encode()).hexdigest()[:20] + ".pdf")
                        raw, ctype, final = fetch(pdf, deadline); path.write_bytes(raw)
                        if raw[:5] != b"%PDF-":
                            stats["invalid_candidates"] += 1; path.unlink(missing_ok=True)
                            attempt = {"engine": engine, "url": final, "result": "invalid-pdf", "validation": "invalid_pdf_signature", "content_type": ctype}; continue
                        ok, msg = valid(path)
                        if not ok:
                            stats["invalid_candidates"] += 1; path.unlink(missing_ok=True)
                            attempt = {"engine": engine, "url": final, "result": "invalid-pdf", "validation": msg}; continue
                        item = {"source": "global:" + engine, "url": final, "bytes": path.stat().st_size, "sha256": sha(path), "validation": {"ok": True, "output": msg}, "status": "acquired_for_review", "local_path": str(path)}
                        found.append(item); attempt = {"engine": engine, "url": final, "result": "acquired", "bytes": item["bytes"], "sha256": item["sha256"], "content_type": ctype}; break
                except TimeoutError: raise
                except Exception as exc:
                    stats["errors"] += 1; attempt["result"] = "error"; attempt["error"] = f"{type(exc).__name__}: {exc}"[:500]
                gap["attempts"].append(attempt)
                if found: break
        except TimeoutError as exc:
            stats["timed_out"] += 1; gap["result"] = "timed_out"; gap["error"] = str(exc)
        if found:
            rec.setdefault("candidates", []).extend(found); rec["acquired"] = acquired + found; rec["acquired_count"] = len(rec["acquired"]); rec["availability"] = "copy-acquired"; rec["acquisition_state"] = "acquired"; rec["rights_action"] = "developer-vault-encrypt"
            gap["result"] = "acquired"; stats["new_acquired_books"] += 1; stats["new_acquired_files"] += len(found)
        else:
            rec.setdefault("retry_history", []).append({"pass": "deep-worldwide-v4", "result": gap["result"], "attempts": gap["attempts"]})
        stats["gaps"].append(gap); checkpoint(data, mp, stats, report)
    checkpoint(data, mp, stats, report)
    print(json.dumps({k: v for k, v in stats.items() if k != "gaps"}, ensure_ascii=False))

if __name__ == "__main__": main()
