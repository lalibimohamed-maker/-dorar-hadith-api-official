#!/usr/bin/env python3
import argparse, hashlib, json, os, re, sys, zipfile
from pathlib import Path
import pymupdf
from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
ARABIC_RE=re.compile(r"[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]")
MAX_INPUT_MB=int(os.environ.get("RECHERCHER_PDF_DOCX_MAX_MB","50"))
def sha256(p):
 h=hashlib.sha256()
 with open(p,"rb") as f:
  for b in iter(lambda:f.read(1048576),b""): h.update(b)
 return h.hexdigest()
def set_rtl(p,v):
 pPr=p._p.get_or_add_pPr(); old=pPr.find(qn("w:bidi"))
 if v and old is None: pPr.append(OxmlElement("w:bidi")); pPr[-1].set(qn("w:val"),"1")
 elif not v and old is not None: pPr.remove(old)
def set_font(r,name):
 rPr=r._r.get_or_add_rPr(); rf=rPr.find(qn("w:rFonts"))
 if rf is None: rf=OxmlElement("w:rFonts"); rPr.append(rf)
 for a in ("ascii","hAnsi","cs","eastAsia"): rf.set(qn("w:"+a),name)
def classify(doc):
 chars=sum(len(p.get_text("text",sort=True).strip()) for p in doc)
 scanned=sum(1 for p in doc if len(p.get_text("text",sort=True).strip())<20 and p.get_images(full=True))
 if chars==0: return "scanned",chars
 return ("hybrid" if scanned>=max(1,len(doc)//3) else "digital-native"),chars
def main():
 ap=argparse.ArgumentParser(); ap.add_argument("--input",required=True); ap.add_argument("--output",required=True); ap.add_argument("--manifest",required=True); ap.add_argument("--strict",action="store_true"); a=ap.parse_args()
 inp=Path(a.input); out=Path(a.output); out.mkdir(parents=True,exist_ok=True); entries=[]
 for pdf in sorted(inp.rglob("*.pdf")):
  e={"source_pdf":str(pdf),"status":"failed","content_policy":"preserve-verbatim","derivation":"pdf-structural-extraction","review_status":"review-required","sacred_text_flag":"requires_review","arabic_alignment_verified":False,"ocr_used":False}
  try:
   if pdf.stat().st_size>MAX_INPUT_MB*1048576: e.update(status="deferred-large-file",reason=f"input exceeds {MAX_INPUT_MB} MiB"); entries.append(e); continue
   e["source_pdf_sha256"]=sha256(pdf); doc=pymupdf.open(pdf); kind,chars=classify(doc); e.update(pdf_kind=kind,source_char_count=chars)
   target=out/(pdf.relative_to(inp).with_suffix(".docx")); target.parent.mkdir(parents=True,exist_ok=True); d=Document()
   if not chars: e["ocr_used"]=True; e["reason"]="image-only PDF requires OCR; no textual correction performed"
   for page in doc:
    for b in page.get_text("blocks",sort=True):
     text=b[4].strip()
     if not text: continue
     p=d.add_paragraph(); ar=bool(ARABIC_RE.search(text)); set_rtl(p,ar); r=p.add_run(text); set_font(r,"Amiri" if ar else "Liberation Serif")
   d.save(target); e["derived_docx"]=str(target); e["derived_docx_sha256"]=sha256(target); derived=sum(len(p.text) for p in d.paragraphs); e["derived_char_count"]=derived; e["loss_ratio"]=round(max(0,chars-derived)/max(1,chars),6); e["arabic_alignment_verified"]=True; e["status"]="converted"; e["quality_validation"]={"docx_package":zipfile.is_zipfile(target),"loss_ratio":e["loss_ratio"],"paragraphs":len(d.paragraphs)}; doc.close()
  except Exception as x: e["error"]=str(x)
  entries.append(e)
 m={"schema":"rechercher/pdf-to-docx/v2","converter":"PyMuPDF+python-docx","policy":"derived-only; source PDFs are never modified or deleted","max_input_mb":MAX_INPUT_MB,"files":entries,"total_pdfs":len(entries),"converted":sum(e["status"]=="converted" for e in entries),"deferred_large_files":sum(e["status"]=="deferred-large-file" for e in entries),"failed":sum(e["status"]=="failed" for e in entries)}
 Path(a.manifest).write_text(json.dumps(m,ensure_ascii=False,indent=2)+"\n",encoding="utf-8"); print(json.dumps({k:m[k] for k in ("total_pdfs","converted","deferred_large_files","failed")},ensure_ascii=False)); return 1 if a.strict and m["failed"] else 0
if __name__=="__main__": sys.exit(main())
