#!/usr/bin/env python3
"""Federate worldwide discovery without confusing discovery with acquisition.

The layer creates auditable search routes across major library, heritage and
Arabic-text ecosystems. Sources requiring keys or interactive search remain
explicitly discovery-only until their access contract is configured.
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
    "waqfeya": {"url": "https://waqfeya.net/", "role": "catalogued-arabic-book-source", "acquisition": True},
}


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--root",required=True); ap.add_argument("--discovery",action="append",required=True); ap.add_argument("--out",required=True); a=ap.parse_args()
    root=Path(a.root).resolve(); entries=[]
    for rel in a.discovery:
        p=root/rel
        if p.exists(): entries.extend(read_json(p).get("entries",[]))
    seen=set(); unique=[]
    for b in entries:
        key=(b.get("title"),b.get("author"),b.get("id"))
        if key not in seen and b.get("title"):
            seen.add(key); unique.append(b)
    records=[]
    for b in unique:
        title=b.get("title",""); author=b.get("author",""); q=quote_plus(" ".join(x for x in [title,author] if x))
        urls={
            "worldcat":f"https://search.worldcat.org/search?q={q}",
            "hathitrust":f"https://catalog.hathitrust.org/Search/Home?lookfor={q}&type=all",
            "dpla":f"https://dp.la/search?q={q}",
            "europeana":f"https://www.europeana.eu/en/search?query={q}",
            "openiti_kitab":"https://kitab-corpus-metadata.azurewebsites.net/",
            "openiti_github":f"https://github.com/search?q={q}+org%3AOpenITI&type=code",
            "internet_archive":f"https://archive.org/search?query={q}",
            "openlibrary":f"https://openlibrary.org/search?q={q}",
            "library_of_congress":f"https://www.loc.gov/search/?q={q}&fo=json",
            "google_books":f"https://books.google.com/books?q={q}",
            "crossref":f"https://search.crossref.org/?q={q}",
            "waqfeya":f"https://waqfeya.net/search?query={q}",
        }
        records.append({"work_id":b.get("id"),"title":title,"author":author,"author_death_hijri":b.get("author_death_hijri",b.get("death_hijri")),"scope":"1-400H","routes": [{"engine":k,"url":v,"role":SOURCES[k]["role"],"acquisition_capable":SOURCES[k]["acquisition"]} for k,v in urls.items()]})
    out=root/a.out; out.parent.mkdir(parents=True,exist_ok=True)
    report={"schema":"developer-review-acquisition/deep-worldwide/v1","generated_at":time.time(),"scope":"1-400H","source_count":len(SOURCES),"work_count":len(records),"sources":SOURCES,"records":records,"policy":"Federated discovery maximizes recall; it never converts a search result into redistribution permission. Exact edition, rights and digital-copy evidence remain mandatory."}
    out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"works":len(records),"sources":len(SOURCES),"routes":len(records)*len(SOURCES)},ensure_ascii=False,sort_keys=True))

if __name__=="__main__": main()
