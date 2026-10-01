#!/usr/bin/env python3
"""Build a real-document candidate index from PR #561's live source registry.

The registry is a discovery pool, not a rights grant. This pass crawls each
registered page once, extracts direct PDF/DOCX links, and matches document
names/URLs to the master book catalog. It never treats a registry entry as
redistributable by itself.
"""
from __future__ import annotations
import html, json, re
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "research/evidence/global-multilingual/worldwide-source-link-registry-2026-09-24.json"
CATALOG = ROOT / "books-batches/encyclopedia-master/catalog.json"
OUT = ROOT / "artifacts/registry-document-candidates.json"
UA = "DinAllah-Rechercher/2.0"
TIMEOUT = 45

def norm(s: str) -> str:
    s = unquote(str(s)).casefold()
    s = re.sub(r"[إأآٱ]", "ا", s)
    s = s.replace("ى", "ي").replace("ة", "ه")
    s = re.sub(r"[^\w\u0600-\u06ff]+", " ", s, flags=re.UNICODE)
    return re.sub(r"\s+", " ", s).strip()

def tokens(s: str) -> set[str]:
    stop = {"كتاب","كتب","المجلد","مجلد","الجزء","ج","pdf","docx","vol","volume","part","the","book"}
    return {x for x in norm(s).split() if len(x) >= 3 and x not in stop}

def fetch(url: str) -> str:
    req = Request(url, headers={"User-Agent": UA})
    with urlopen(req, timeout=TIMEOUT) as r:
        return r.read().decode("utf-8", "replace")

def links(page: str, base: str):
    out = []
    for m in re.finditer(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', page, re.I|re.S):
        href = html.unescape(m.group(1)).strip()
        label = re.sub(r"<[^>]+>", " ", m.group(2))
        u = urljoin(base, href)
        if re.search(r"\.(pdf|docx)(?:[?#]|$)", u, re.I) and not re.search(r"\.pdf\.enc(?:[?#]|$)", u, re.I):
            out.append({"url": u, "label": re.sub(r"\s+", " ", label).strip()})
    return out

def main():
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    books = [b for b in catalog.get("books", []) if b.get("id")]
    discovered = []
    errors = []
    for source in registry.get("sources", []):
        url = source.get("url")
        if not url:
            continue
        try:
            page = fetch(url)
            for item in links(page, url):
                item.update({
                    "registry_source_id": source.get("id"),
                    "registry_source_name": source.get("name"),
                    "registry_source_url": url,
                    "rights_status": "review_required",
                })
                discovered.append(item)
        except Exception as exc:
            errors.append({"source": url, "error": str(exc)})

    mapped = {str(b["id"]): [] for b in books}
    for doc in discovered:
        hay = tokens(doc["url"] + " " + doc["label"])
        if not hay:
            continue
        matches = []
        for b in books:
            bt = tokens(b.get("title") or b.get("titleAr") or "")
            if not bt:
                continue
            overlap = len(bt & hay)
            ratio = overlap / max(1, min(len(bt), 6))
            if overlap >= 2 or (len(bt) == 1 and overlap == 1):
                matches.append((ratio, overlap, str(b["id"])))
        for ratio, overlap, bid in sorted(matches, reverse=True)[:8]:
            mapped[bid].append({**doc, "match_ratio": round(ratio, 3), "match_tokens": overlap})

    for bid in mapped:
        seen = set()
        mapped[bid] = [x for x in mapped[bid] if not (x["url"] in seen or seen.add(x["url"]))]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "schema": "din-allah/rechercher-registry-document-candidates/v1",
        "source_registry_pr": 561,
        "registry_sources": len(registry.get("sources", [])),
        "pages_with_errors": len(errors),
        "documents_discovered": len(discovered),
        "books_with_candidates": sum(bool(v) for v in mapped.values()),
        "candidates": mapped,
        "errors": errors,
        "rights_rule": "registry discovery never grants redistribution permission",
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"REGISTRY_561_SOURCES={len(registry.get('sources', []))}", flush=True)
    print(f"REGISTRY_DOCUMENTS_DISCOVERED={len(discovered)}", flush=True)
    print(f"REGISTRY_BOOKS_WITH_CANDIDATES={sum(bool(v) for v in mapped.values())}", flush=True)
    print(f"REGISTRY_SOURCE_ERRORS={len(errors)}", flush=True)

if __name__ == "__main__":
    main()
