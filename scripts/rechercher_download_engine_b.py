#!/usr/bin/env python3
"""Rechercher Engine B: independent PDF download fallback.

Engine B is a real downloader, not a discovery-only layer. It consumes the
source-engine candidate manifest, downloads only real PDFs, validates the PDF
signature and qpdf integrity, records provenance/sha256, and writes only when
Engine A has not already produced a valid primary PDF for the book.

It never creates .pdf.enc, never deletes a primary PDF, and does not infer
redistribution rights from discoverability.
"""
from __future__ import annotations
import argparse, hashlib, json, re, subprocess
from pathlib import Path
from urllib.request import Request, urlopen

UA="DinAllah-Encyclopedia/Rechercher-Engine-B/1.0"
TIMEOUT=120

def sha256(p):
    h=hashlib.sha256()
    with p.open("rb") as f:
        for c in iter(lambda:f.read(1024*1024),b""): h.update(c)
    return h.hexdigest()

def valid_pdf(p):
    try:
        return p.is_file() and p.stat().st_size > 0 and p.open("rb").read(5)==b"%PDF-"
    except OSError:
        return False

def qpdf_ok(p):
    r=subprocess.run(["qpdf","--check",str(p)],text=True,capture_output=True,check=False)
    return r.returncode in (0,3)

def download(url,dst):
    if re.search(r"\.pdf\.enc(?:[?#]|$)",url,re.I):
        raise ValueError("encrypted candidate rejected")
    req=Request(url,headers={"User-Agent":UA})
    with urlopen(req,timeout=TIMEOUT) as r:
        with dst.open("wb") as f:
            while True:
                c=r.read(1024*1024)
                if not c: break
                f.write(c)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--root",default=".")
    ap.add_argument("--candidates",default="artifacts/governance/engine-b-candidates.json")
    ap.add_argument("--out",default="artifacts/governance/engine-b-download-manifest.json")
    ap.add_argument("--pdf-root",default="artifacts")
    a=ap.parse_args()
    root=Path(a.root).resolve()
    data=json.loads((root/a.candidates).read_text(encoding="utf-8"))
    records=[]
    pdfroot=root/a.pdf_root
    for item in data.get("entries",[]):
        book_id=str(item.get("id") or "").strip()
        if not book_id: continue
        safe=re.sub(r"[^a-z0-9._-]+","-",book_id.lower()).strip("-")
        existing=sorted(pdfroot.glob(f"{safe}.pdf"))
        if existing and any(valid_pdf(p) and qpdf_ok(p) for p in existing):
            records.append({"id":book_id,"status":"skipped-engine-a-success","engine":"B"})
            continue
        urls=[]
        for c in item.get("sources",[]):
            if isinstance(c,dict) and c.get("url") and c["url"] not in urls:
                urls.append(c["url"])
        work=pdfroot/f".engine-b-{safe}"
        work.mkdir(parents=True,exist_ok=True)
        selected=None
        attempts=[]
        for i,url in enumerate(urls[:24],1):
            tmp=work/f"candidate-{i}.pdf"
            try:
                download(url,tmp)
                if not valid_pdf(tmp):
                    attempts.append({"url":url,"status":"invalid-signature"}); tmp.unlink(missing_ok=True); continue
                if not qpdf_ok(tmp):
                    attempts.append({"url":url,"status":"qpdf-rejected"}); tmp.unlink(missing_ok=True); continue
                selected=tmp
                attempts.append({"url":url,"status":"selected","sha256":sha256(tmp)})
                break
            except Exception as exc:
                attempts.append({"url":url,"status":"error","error":type(exc).__name__})
                tmp.unlink(missing_ok=True)
        if selected:
            final=pdfroot/f"{safe}.pdf"
            if not final.exists():
                selected.replace(final)
                records.append({"id":book_id,"status":"downloaded-by-engine-b","engine":"B","url":attempts[-1]["url"],"sha256":sha256(final),"bytes":final.stat().st_size,"rights":"review-required-unless-verified"})
            else:
                selected.unlink(missing_ok=True)
                records.append({"id":book_id,"status":"primary-exists-no-replacement","engine":"B"})
        else:
            records.append({"id":book_id,"status":"no-valid-candidate","engine":"B","attempts":attempts})
        for p in work.glob("*.pdf"): p.unlink(missing_ok=True)
        try: work.rmdir()
        except OSError: pass
    out=root/a.out
    out.parent.mkdir(parents=True,exist_ok=True)
    manifest={"schema":"din-allah-encyclopedia/rechercher-engine-b/v1","engine":"B","role":"independent-pdf-download-fallback","no_pdf_enc":True,"records":records}
    out.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("ENGINE_B_DOWNLOAD",json.dumps({"downloaded":sum(r.get("status")=="downloaded-by-engine-b" for r in records),"skipped":sum(r.get("status")=="skipped-engine-a-success" for r in records),"failed":sum(r.get("status")=="no-valid-candidate" for r in records)},ensure_ascii=False,sort_keys=True))

if __name__=="__main__":
    main()
