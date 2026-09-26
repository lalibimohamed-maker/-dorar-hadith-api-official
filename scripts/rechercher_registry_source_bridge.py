#!/usr/bin/env python3
"""Bridge the live PR #561 source registry into the chronological book catalog.

The registry is a source/discovery pool, not a book catalog. This bridge crawls each
registered source page once, extracts PDF candidates, and attaches only candidates
whose visible page/anchor text matches a catalogued work. Rights remain fail-closed.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import html
import json
import re
import time
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit
from urllib.request import Request, urlopen

UA = "DinAllah-Encyclopedia/Rechercher-561-Source-Bridge/1.0"
MAX_SOURCE_BYTES = 3 * 1024 * 1024
MAX_PDFS_PER_SOURCE = 40
MAX_DISCOVERY_WORKERS = 16
MAX_BOOK_CANDIDATES = 12
MIN_SCORE = 0.60
MARKS = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]")

def norm(value: object) -> str:
    s = MARKS.sub("", str(value or ""))
    s = s.replace("ـ", "")
    s = s.translate(str.maketrans({
        "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
        "ى": "ي", "ة": "ه", "ؤ": "و", "ئ": "ي",
    })).casefold()
    s = re.sub(r"[^\w\u0600-\u06FF]+", " ", s, flags=re.UNICODE)
    return re.sub(r"\s+", " ", s).strip()

def tokens(value: object) -> set[str]:
    stop = {
        "من","في","على","عن","إلى","الى","و","أو","او","ثم","بن","ابن",
        "أبو","ابي","أبي","ام","أم","هذا","هذه","ذلك","تلك",
        "كتاب","كتب","جزء","مجلد","تحقيق","شرح","دار","طبعة","الطبعة"
    }
    return {x for x in norm(value).split() if len(x) >= 2 and x not in stop}

def similarity(needles: str, hay: str) -> float:
    a, b = tokens(needles), tokens(hay)
    if not a or not b:
        return 0.0
    return len(a & b) / max(1, len(a))

def fetch(url: str) -> tuple[str, str]:
    req = Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/json,application/pdf,*/*;q=0.1",
    })
    with urlopen(req, timeout=25) as response:
        data = response.read(MAX_SOURCE_BYTES + 1)
        if len(data) > MAX_SOURCE_BYTES:
            data = data[:MAX_SOURCE_BYTES]
        return data.decode("utf-8", "replace"), response.geturl()

def extract_pdf_candidates(source_url: str) -> dict:
    result = {
        "source_url": source_url,
        "final_url": source_url,
        "pdfs": [],
        "error": None,
    }
    try:
        page, final = fetch(source_url)
        result["final_url"] = final
        if page.lstrip().startswith("%PDF-") or "application/pdf" in page[:200].lower():
            result["pdfs"] = [{
                "pdf_url": final,
                "anchor_text": Path(unquote(urlsplit(final).path)).name,
                "page_title": "",
            }]
            return result

        # Capture title plus anchor/nearby text. We intentionally stay one page deep.
        title_match = re.search(r"<title[^>]*>(.*?)</title>", page, re.I | re.S)
        page_title = html.unescape(re.sub(r"<[^>]+>", " ", title_match.group(1))).strip() if title_match else ""
        pattern = re.compile(
            r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',
            re.I | re.S,
        )
        seen = set()
        for match in pattern.finditer(page):
            href = html.unescape(match.group(1).strip())
            if not href:
                continue
            u = urljoin(final, href)
            parts = urlsplit(u)
            if parts.scheme != "https" or parts.username or parts.password:
                continue
            if not (re.search(r"\.(?:pdf|docx)(?:$|[?#])", u, re.I) or "archive.org/download/" in u.lower()):
                continue
            if u in seen:
                continue
            seen.add(u)
            anchor = html.unescape(re.sub(r"<[^>]+>", " ", match.group(2))).strip()
            result["pdfs"].append({
                "pdf_url": u,
                "anchor_text": anchor[:600],
                "page_title": page_title[:600],
            })
            if len(result["pdfs"]) >= MAX_PDFS_PER_SOURCE:
                break

        # Also catch plain absolute PDF URLs embedded in source JSON/HTML.
        for raw in re.findall(r"https://[^\s"'<>]+\.pdf(?:\?[^\s"'<>]*)?", page, re.I):
            u = html.unescape(raw).rstrip("),.;")
            if u not in seen and len(result["pdfs"]) < MAX_PDFS_PER_SOURCE:
                seen.add(u)
                result["pdfs"].append({
                    "pdf_url": u,
                    "anchor_text": Path(unquote(urlsplit(u).path)).name,
                    "page_title": page_title[:600],
                })
    except Exception as exc:
        result["error"] = f"{type(exc).__name__}: {str(exc)[:300]}"
    return result

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--registry", required=True)
    ap.add_argument("--catalog", default="books-batches/encyclopedia-master/catalog.json")
    ap.add_argument("--out", default="artifacts/governance/source-registry-561-bridge.json")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    registry = json.loads((root / args.registry).read_text(encoding="utf-8"))
    catalog_path = root / args.catalog
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    sources = [s for s in registry.get("sources", []) if isinstance(s, dict) and isinstance(s.get("url"), str) and s["url"].startswith("https://")]
    books = [b for b in catalog.get("books", []) if isinstance(b, dict) and b.get("title")]

    started = time.time()
    crawled = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_DISCOVERY_WORKERS) as pool:
        futures = {pool.submit(extract_pdf_candidates, s["url"]): s for s in sources}
        for future in concurrent.futures.as_completed(futures):
            src = futures[future]
            row = future.result()
            row["source_id"] = src.get("id")
            row["source_name"] = src.get("name")
            row["category"] = src.get("category")
            crawled.append(row)

    matched = 0
    added = 0
    errors = sum(1 for x in crawled if x.get("error"))
    for book in books:
        title = str(book.get("title") or "")
        author = str(book.get("author") or "")
        query = f"{title} {author}".strip()
        candidates = []
        for src in crawled:
            for pdf in src.get("pdfs", []):
                evidence = " ".join([
                    str(src.get("source_name") or ""),
                    str(src.get("category") or ""),
                    str(pdf.get("anchor_text") or ""),
                    str(pdf.get("page_title") or ""),
                    pdf.get("pdf_url", "").rsplit("/", 1)[-1],
                ])
                score = max(similarity(title, evidence), similarity(query, evidence))
                if score < MIN_SCORE:
                    continue
                candidates.append({
                    "url": src["final_url"],
                    "pdf_url": pdf["pdf_url"],
                    "label": "worldwide-registry-561",
                    "provider": src.get("source_name") or src.get("id") or "PR-561",
                    "discovery": "live PR #561 source registry page bridge",
                    "match_score": round(score, 4),
                    "rights_review_required": True,
                    "source_registry_id": src.get("source_id"),
                    "source_registry_url": src.get("source_url"),
                })
        candidates.sort(key=lambda x: (-x["match_score"], x["pdf_url"]))
        unique = []
        seen = set()
        for c in candidates:
            if c["pdf_url"] in seen:
                continue
            seen.add(c["pdf_url"])
            unique.append(c)
            if len(unique) >= MAX_BOOK_CANDIDATES:
                break
        if not unique:
            continue

        existing = book.get("sources") if isinstance(book.get("sources"), list) else []
        existing_urls = {
            x.get("pdf_url") or x.get("url")
            for x in existing if isinstance(x, dict)
        }
        new = [c for c in unique if c["pdf_url"] not in existing_urls and c["url"] not in existing_urls]
        if new:
            book["sources"] = existing + new
            book["source_registry_bridge"] = {
                "registry_pr": 561,
                "registry_runtime_branch": "feat/rechercher-worldwide-source-link-registry-2026-09-24",
                "added_candidates": len(new),
                "rights_review_required": True,
            }
            added += len(new)
        matched += 1

    catalog["source_registry_561"] = {
        "registry_branch": "feat/rechercher-worldwide-source-link-registry-2026-09-24",
        "registry_source_count": len(sources),
        "source_urls_crawled": len(crawled),
        "source_pages_with_errors": errors,
        "books_with_registry_matches": matched,
        "new_pdf_candidates_attached": added,
        "runtime_fetched": True,
        "rights_inference_forbidden": True,
        "corpus_write": False,
    }
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    out = root / args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({
        "schema": "rechercher/source-registry-561-bridge/v1",
        "registry": {
            "branch": "feat/rechercher-worldwide-source-link-registry-2026-09-24",
            "source_count": len(sources),
            "unique_source_urls": len({s["url"] for s in sources}),
        },
        "crawl": {
            "sources_crawled": len(crawled),
            "sources_with_errors": errors,
            "elapsed_seconds": round(time.time() - started, 2),
        },
        "books_with_matches": matched,
        "new_pdf_candidates_attached": added,
        "policy": {
            "real_pdf_only": True,
            "rights_verification_required": True,
            "public_redistribution_not_inferred": True,
            "corpus_write": False,
        },
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "registry_sources": len(sources),
        "crawled": len(crawled),
        "errors": errors,
        "books_with_matches": matched,
        "new_pdf_candidates_attached": added,
    }, ensure_ascii=False, sort_keys=True))

if __name__ == "__main__":
    main()
