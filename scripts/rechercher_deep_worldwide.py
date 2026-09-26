#!/usr/bin/env python3
"""Federate worldwide discovery without confusing discovery with acquisition.

The layer creates auditable search routes across major library, heritage,
scholarly-metadata and Arabic-text ecosystems. Sources requiring keys or
interactive search remain explicitly discovery-only until their access
contract is configured. Research processing tools are derivative-only and
must never become authoritative Corpus witnesses.
"""
import argparse, json, time
from pathlib import Path
from urllib.parse import quote_plus

SOURCES = {
    "worldcat": {"url": "https://search.worldcat.org/", "role": "global-library-identity", "acquisition": False},
    "hathitrust": {"url": "https://catalog.hathitrust.org/", "role": "library-identity-and-digital-access", "acquisition": False},
    "dpla": {"url": "https://dp.la/", "role": "aggregated-cultural-heritage-metadata", "acquisition": False},
    "europeana": {"url": "https://www.europeana.eu/", "role": "aggregated-cultural-heritage-metadata-and-iiif", "acquisition": False},
    "openiti_kitab": {"url": "https://kitab-corpus-metadata.azurewebsites.net/", "role": "arabic-text-identity-and-version-metadata", "acquisition": False},
    "openiti_github": {"url": "https://github.com/OpenITI/RELEASE", "role": "machine-readable-arabic-corpus-evidence", "acquisition": False},
    "internet_archive": {"url": "https://archive.org/", "role": "digital-copy-candidate", "acquisition": True},
    "openlibrary": {"url": "https://openlibrary.org/", "role": "edition-and-digital-identifier", "acquisition": False},
    "library_of_congress": {"url": "https://www.loc.gov/", "role": "national-library-identity", "acquisition": False},
    "google_books": {"url": "https://books.google.com/", "role": "bibliographic-and-viewability-evidence", "acquisition": False},
    "crossref": {"url": "https://www.crossref.org/", "role": "bibliographic-and-license-metadata", "acquisition": False},
    "openalex": {"url": "https://api.openalex.org/works", "role": "scholarly-work-identity-open-access-and-citation-discovery", "acquisition": False},
    "opencitations": {"url": "https://api.opencitations.net/", "role": "scholarly-citation-and-bibliographic-enrichment", "acquisition": False},
    "waqfeya": {"url": "https://waqfeya.net/", "role": "catalogued-arabic-book-source", "acquisition": True, "priority": 0},
    "shamela": {"url": "https://shamela.ws/", "role": "arabic-book-text-identity-and-discovery", "acquisition": False, "priority": 0},
    "openiti": {"url": "https://openiti.org/", "role": "machine-readable-islamicate-text-and-work-identity", "acquisition": False, "priority": 0},
    "openiti_release": {"url": "https://github.com/OpenITI/RELEASE", "role": "release-pinned-machine-readable-corpus", "acquisition": False, "priority": 0},
    "kitab_zenodo_full": {"url": "https://zenodo.org/records/17767721", "role": "reproducible-openiti-kitab-full-release", "acquisition": False, "priority": 0},
    "kitab_zenodo_primary": {"url": "https://zenodo.org/records/18613982", "role": "primary-openiti-kitab-release", "acquisition": False, "priority": 0},
    "shamela_api_discovery": {"url": "https://github.com/dalailcentere/shamela-api", "role": "shamela-api-discovery-route", "acquisition": False, "priority": 0},
}

RESEARCH_TOOLS = {
    "grobid": {
        "url": "https://github.com/grobidOrg/grobid",
        "role": "pdf-to-structured-tei-bibliographic-research-extraction",
        "mode": "optional-post-acquisition-derivative",
        "authoritative": False,
    },
    "kraken": {
        "url": "https://kraken.re/",
        "role": "historical-and-non-latin-ocr-layout-reading-order",
        "mode": "optional-post-acquisition-derivative",
        "authoritative": False,
    },
    "escriptorium": {
        "url": "https://escriptorium.eu/",
        "role": "human-review-and-training-workbench-for-historical-ocr-htr",
        "mode": "research-review",
        "authoritative": False,
    },
}


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--discovery", action="append", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    root = Path(a.root).resolve()
    entries = []
    for rel in a.discovery:
        p = root / rel
        if p.exists():
            entries.extend(read_json(p).get("entries", []))

    seen = set()
    unique = []
    for b in entries:
        key = (b.get("title"), b.get("author"), b.get("id"))
        if key not in seen and b.get("title"):
            seen.add(key)
            unique.append(b)

    records = []
    for b in unique:
        title = b.get("title", "")
        author = b.get("author", "")
        q = quote_plus(" ".join(x for x in [title, author] if x))
        urls = {
            "worldcat": f"https://search.worldcat.org/search?q={q}",
            "hathitrust": f"https://catalog.hathitrust.org/Search/Home?lookfor={q}&type=all",
            "dpla": f"https://dp.la/search?q={q}",
            "europeana": f"https://www.europeana.eu/en/search?query={q}",
            "openiti_kitab": "https://kitab-corpus-metadata.azurewebsites.net/",
            "openiti_github": f"https://github.com/search?q={q}+org%3AOpenITI&type=code",
            "internet_archive": f"https://archive.org/search?query={q}",
            "openlibrary": f"https://openlibrary.org/search?q={q}",
            "library_of_congress": f"https://www.loc.gov/search/?q={q}&fo=json",
            "google_books": f"https://books.google.com/books?q={q}",
            "crossref": f"https://search.crossref.org/?q={q}",
            "openalex": f"https://api.openalex.org/works?search={q}&select=id,display_name,publication_year,type,doi,open_access,best_oa_location",
            "opencitations": "https://api.opencitations.net/",
            "waqfeya": f"https://waqfeya.net/search?query={q}",
            "shamela": f"https://shamela.ws/search?query={q}",
            "openiti": "https://openiti.org/",
            "openiti_release": f"https://github.com/search?q={q}+org%3AOpenITI&type=code",
            "kitab_zenodo_full": f"https://zenodo.org/search?q={q}",
            "kitab_zenodo_primary": f"https://zenodo.org/search?q={q}%20OpenITI%20primary",
            "shamela_api_discovery": f"https://github.com/dalailcentere/shamela-api/search?q={q}",
        }
        identifier_routes = []
        doi = b.get("doi")
        if doi:
            identifier_routes.append({
                "engine": "opencitations",
                "url": f"https://api.opencitations.net/meta/api/v1/metadata/doi:{quote_plus(str(doi))}",
                "role": SOURCES["opencitations"]["role"],
            })
        records.append({
            "work_id": b.get("id"),
            "title": title,
            "author": author,
            "author_death_hijri": b.get("author_death_hijri", b.get("death_hijri")),
            "scope": "1-400H",
            "routes": [
                {"engine": k, "url": v, "role": SOURCES[k]["role"], "acquisition_capable": SOURCES[k]["acquisition"]}
                for k, v in urls.items()
            ],
            "identifier_routes": identifier_routes,
        })

    out = root / a.out
    out.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "schema": "developer-review-acquisition/deep-worldwide/v2",
        "generated_at": time.time(),
        "scope": "1-400H",
        "source_count": len(SOURCES),
        "priority_source_count": sum(1 for x in SOURCES.values() if x.get("priority") == 0),
        "research_tool_count": len(RESEARCH_TOOLS),
        "work_count": len(records),
        "sources": SOURCES,
        "research_tools": RESEARCH_TOOLS,
        "records": records,
        "search_order": ["priority_sources", "all_registered_sources", "bounded_web_discovery"],
        "policy": (
            "Federated discovery maximizes recall; it never converts a search result into "
            "redistribution permission. Exact edition, rights and digital-copy evidence remain "
            "mandatory. Research tools may create derivatives for review/search, but never replace "
            "the canonical witness or write directly to Corpus."
        ),
    }
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "works": len(records),
        "sources": len(SOURCES),
        "research_tools": len(RESEARCH_TOOLS),
        "routes": len(records) * len(SOURCES),
    }, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
