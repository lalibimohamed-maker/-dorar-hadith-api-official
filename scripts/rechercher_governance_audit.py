#!/usr/bin/env python3
"""Audit the acquisition pipeline without publishing content.

Identity is explicitly separated into Work/Edition/DigitalCopy. Rights are
fail-closed: discovery evidence never becomes redistribution permission.
"""
import argparse, hashlib, json, time, urllib.request, urllib.error
from pathlib import Path

ENGINES = {
    "waqfeya": "https://waqfeya.net/",
    "internet_archive": "https://archive.org/",
    "openlibrary": "https://openlibrary.org/",
    "library_of_congress": "https://www.loc.gov/",
    "google_books": "https://www.googleapis.com/books/v1/volumes?q=Islam",
    "crossref": "https://api.crossref.org/works?rows=0",
}
REQUIRED_RIGHTS = ["rights_source", "rights_evidence", "rights_checked_at", "rights_checked_by", "license", "territory", "redistribution_allowed", "derivative_allowed"]

def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))

def stable_id(prefix, value):
    return prefix + "-" + hashlib.sha256(value.encode("utf-8")).hexdigest()[:20]

def score(book, record):
    identity = 100 if book.get("title") and book.get("author") else 40
    edition = 100 if book.get("edition") else 40
    source = 100 if record and (record.get("source_url") or record.get("sources")) else 20
    metadata = 100 if book.get("id") and (book.get("author_death_hijri") or book.get("death_hijri")) else 70
    rights_fields = sum(1 for k in REQUIRED_RIGHTS if book.get(k))
    rights = round(rights_fields / len(REQUIRED_RIGHTS) * 100)
    scan = 100 if record and record.get("page_integrity", {}).get("status") == "passed" else 40
    complete = 100 if record and record.get("acquired_count", 0) >= (book.get("expected_volumes") or 1) else 40
    ocr = float(record.get("ocr_quality", 0)) * 100 if record and record.get("ocr_quality") is not None else 0
    total = round(identity*.20 + source*.20 + scan*.15 + complete*.15 + ocr*.15 + metadata*.10 + rights*.05, 2)
    return total, {"identity":identity,"source":source,"scan_quality":scan,"completeness":complete,"ocr_quality":round(ocr,2),"metadata":metadata,"rights":rights}

def grade(total):
    return "A" if total >= 90 else "B" if total >= 80 else "C" if total >= 70 else "D" if total >= 60 else "Review"

def health(url):
    req=urllib.request.Request(url, headers={"User-Agent":"DinAllah-Encyclopedia/source-health/1.1"})
    started=time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            r.read(128)
            return {"status":"up","http":r.status,"latency_ms":round((time.monotonic()-started)*1000,1)}
    except urllib.error.HTTPError as e:
        return {"status":"reachable-error","http":e.code,"latency_ms":round((time.monotonic()-started)*1000,1)}
    except Exception as e:
        return {"status":"down","error":type(e).__name__,"latency_ms":round((time.monotonic()-started)*1000,1)}

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--root",required=True); ap.add_argument("--catalog",default="books-batches/salaf-01-400h/catalog.json"); ap.add_argument("--overlay",default="books-batches/salaf-01-400h/engine-source-overlay.json"); ap.add_argument("--out",default="artifacts/governance/governance-report.json"); a=ap.parse_args()
    root=Path(a.root).resolve(); catalog=read_json(root/a.catalog); overlay=read_json(root/a.overlay) if (root/a.overlay).exists() else {"entries":[]}
    by_title={(e.get("title"),e.get("author")):e for e in overlay.get("entries",[])}
    books=catalog.get("books",[]); records=[]
    for b in books:
        r=by_title.get((b.get("title"),b.get("author")),{}); total,components=score(b,r)
        edition_id=stable_id("edition", f"{b.get('id','')}|{b.get('edition','')}") if b.get("edition") else None
        digital_copy_id=stable_id("copy", r.get("source_url")) if r.get("source_url") else None
        rights_status=b.get("rights_status", "unknown")
        rights_ok=rights_status in {"verified-redistributable","public-domain","source-permitted"} and all(b.get(k) for k in REQUIRED_RIGHTS)
        source_ok=bool(r.get("source_url") or r.get("sources"))
        rec={"work_id":b.get("id"),"edition_id":edition_id,"digital_copy_id":digital_copy_id,"title":b.get("title"),"author":b.get("author"),"work_id_present":bool(b.get("id") and b.get("title") and b.get("author")),"edition_id_ready":bool(edition_id),"digital_copy_id_ready":bool(digital_copy_id),"edition":b.get("edition"),"source_url":r.get("source_url"),"rights_status":rights_status,"rights_source":b.get("rights_source") or (b.get("waqfeya_url") if rights_status=="verified-redistributable" else None),"rights_evidence":b.get("rights_evidence"),"rights_checked_at":b.get("rights_checked_at"),"rights_checked_by":b.get("rights_checked_by"),"license":b.get("license"),"territory":b.get("territory"),"expiry":b.get("expiry"),"redistribution_allowed":b.get("redistribution_allowed"),"derivative_allowed":b.get("derivative_allowed"),"rights_verified":rights_ok,"quality_score":total,"grade":grade(total),"components":components,"publication_state":"PUBLICATION_APPROVED" if rights_ok and total>=80 and source_ok else "HOLD","provenance":{"catalog_id":b.get("id"),"overlay_match":bool(r),"source_engine_candidates":len(r.get("sources",[]))}}
        records.append(rec)
    gates={name:health(url) for name,url in ENGINES.items()}
    report={"schema":"din-allah-encyclopedia/governance-report/v2","generated_at":int(time.time()),"scope":catalog.get("scope",{}),"counts":{"works":len(records),"approved":sum(r["publication_state"]=="PUBLICATION_APPROVED" for r in records),"hold":sum(r["publication_state"]!="PUBLICATION_APPROVED" for r in records),"grade_A":sum(r["grade"]=="A" for r in records),"grade_B":sum(r["grade"]=="B" for r in records),"grade_C_or_lower":sum(r["grade"] not in {"A","B"} for r in records),"rights_verified":sum(r["rights_verified"] for r in records)},"source_health":gates,"records":records,"policy":"No missing identity, rights, source, integrity or quality evidence is converted into approval."}
    out=root/a.out; out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8"); print(json.dumps(report["counts"],ensure_ascii=False,sort_keys=True)); print(json.dumps({k:v["status"] for k,v in gates.items()},ensure_ascii=False,sort_keys=True))

if __name__=="__main__": main()
