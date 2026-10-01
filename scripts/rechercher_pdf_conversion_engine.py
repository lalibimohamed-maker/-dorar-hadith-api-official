#!/usr/bin/env python3
"""On-demand derived-format conversion from a canonical validated PDF.

The canonical PDF is never replaced. Scanned PDFs are OCR-preprocessed into a
temporary derivative only; the original canonical PDF remains byte-for-byte
untouched. Every output records the source PDF SHA-256.
"""
from __future__ import annotations
import argparse, hashlib, json, shutil, subprocess, tempfile
from pathlib import Path
FORMATS={"docx":"docx","pptx":"pptx","epub":"epub","html":"html","md":"markdown","txt":"plain","odt":"odt","rtf":"rtf"}
def sha256(path:Path)->str:
 h=hashlib.sha256()
 with path.open("rb") as f:
  for chunk in iter(lambda:f.read(1024*1024),b""): h.update(chunk)
 return h.hexdigest()
def run(cmd): return subprocess.run(cmd,check=True,text=True,capture_output=True)
def ensure_pdf(pdf:Path):
 if not pdf.is_file() or pdf.read_bytes()[:5]!=b"%PDF-": raise SystemExit("input is not a real PDF")
 run(["qpdf","--check",str(pdf)])
def text_density(pdf:Path)->int:
 with tempfile.TemporaryDirectory(prefix="rechercher-density-") as td:
  txt=Path(td)/"sample.txt"
  p=subprocess.run(["pdftotext","-f","1","-l","5","-layout",str(pdf),str(txt)],text=True,capture_output=True)
  if p.returncode!=0 or not txt.exists(): return 0
  return len(txt.read_text(encoding="utf-8",errors="ignore").strip())
def conversion_source(pdf:Path,languages:str):
 if text_density(pdf)>=80: return pdf,None
 td=tempfile.TemporaryDirectory(prefix="rechercher-ocr-")
 ocr=Path(td.name)/"ocr.pdf"
 run(["ocrmypdf","--skip-text","--rotate-pages","--deskew","-l",languages,str(pdf),str(ocr)])
 return ocr,td
def convert(pdf:Path,fmt:str,out:Path,ocr_languages:str):
 ensure_pdf(pdf); source,cleanup=conversion_source(pdf,ocr_languages)
 try:
  with tempfile.TemporaryDirectory(prefix="rechercher-convert-") as td:
   tmp=Path(td)
   if fmt=="docx":
    try: run(["pdf2docx","convert",str(source),str(out)])
    except Exception:
     run(["libreoffice","--headless","--convert-to","docx","--outdir",str(tmp),str(source)])
     generated=tmp/(source.stem+".docx")
     if not generated.exists(): raise
     shutil.copy2(generated,out)
   elif fmt=="pptx":
    import fitz
    from pptx import Presentation
    from pptx.util import Inches
    doc=fitz.open(source); prs=Presentation(); prs.slide_width=Inches(13.333); prs.slide_height=Inches(7.5); blank=prs.slide_layouts[6]
    for i,page in enumerate(doc):
     png=tmp/f"page-{i+1:05d}.png"; page.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False).save(png)
     slide=prs.slides.add_slide(blank); slide.shapes.add_picture(str(png),0,0,width=prs.slide_width,height=prs.slide_height)
    prs.save(out)
   elif fmt=="epub":
    txt=tmp/"input.txt"; run(["pdftotext","-layout",str(source),str(txt)]); run(["pandoc",str(txt),"-f","plain","-t","epub","-o",str(out)])
   elif fmt=="html":
    p=subprocess.run(["pdftohtml","-noframes","-hidden","-stdout",str(source)],check=True,text=True,capture_output=True); out.write_text(p.stdout,encoding="utf-8")
   elif fmt=="md":
    txt=tmp/"input.txt"; run(["pdftotext","-layout",str(source),str(txt)]); run(["pandoc",str(txt),"-f","plain","-t","markdown","-o",str(out)])
   elif fmt=="txt": run(["pdftotext","-layout",str(source),str(out)])
   elif fmt in {"odt","rtf"}:
    run(["libreoffice","--headless","--convert-to",fmt,"--outdir",str(tmp),str(source)])
    generated=tmp/(source.stem+"."+fmt)
    if not generated.exists(): raise RuntimeError(f"LibreOffice did not produce {fmt}")
    shutil.copy2(generated,out)
   else: raise SystemExit(f"unsupported format: {fmt}")
 finally:
  if cleanup is not None: cleanup.cleanup()
def main():
 ap=argparse.ArgumentParser(); ap.add_argument("pdf",type=Path); ap.add_argument("--format",choices=sorted(FORMATS),required=True); ap.add_argument("--output",type=Path,required=True); ap.add_argument("--ocr-languages",default="ara+eng"); args=ap.parse_args()
 args.output.parent.mkdir(parents=True,exist_ok=True); source_sha=sha256(args.pdf); convert(args.pdf,args.format,args.output,args.ocr_languages)
 if not args.output.is_file() or args.output.stat().st_size==0: raise SystemExit("derived output is empty")
 print(json.dumps({"source_pdf":str(args.pdf),"source_sha256":source_sha,"derived_format":args.format,"derived_file":str(args.output),"derived_bytes":args.output.stat().st_size,"derived_sha256":sha256(args.output),"canonical_pdf_unchanged":True},ensure_ascii=False))
if __name__=="__main__": main()
