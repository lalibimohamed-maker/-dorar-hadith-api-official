#!/usr/bin/env python3
"""On-demand derived-format conversion from the canonical validated PDF.

The canonical PDF is never replaced. Every derived artifact records the source
PDF SHA-256 and is safe to cache or publish only under the source rights policy.
"""
from __future__ import annotations
import argparse, hashlib, json, shutil, subprocess, tempfile
from pathlib import Path

FORMATS = {
    "docx": "docx",
    "pptx": "pptx",
    "epub": "epub",
    "html": "html",
    "md": "markdown",
    "txt": "plain",
    "odt": "odt",
    "rtf": "rtf",
}

def sha256(path: Path) -> str:
    h=hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024), b""):
            h.update(chunk)
    return h.hexdigest()

def run(cmd):
    return subprocess.run(cmd, check=True, text=True, capture_output=True)

def ensure_pdf(pdf: Path):
    if not pdf.is_file() or pdf.read_bytes()[:5] != b"%PDF-":
        raise SystemExit("input is not a real PDF")

def convert(pdf: Path, fmt: str, out: Path):
    ensure_pdf(pdf)
    with tempfile.TemporaryDirectory(prefix="rechercher-convert-") as td:
        tmp=Path(td)
        if fmt == "docx":
            try:
                run(["pdf2docx", "convert", str(pdf), str(out)])
            except Exception:
                run(["libreoffice","--headless","--convert-to","docx","--outdir",str(tmp),str(pdf)])
                generated=tmp/(pdf.stem+".docx")
                if not generated.exists(): raise
                shutil.copy2(generated,out)
        elif fmt == "pptx":
            # Robust fallback: render each PDF page and create one slide per page.
            import fitz
            from pptx import Presentation
            from pptx.util import Inches
            doc=fitz.open(pdf)
            prs=Presentation()
            prs.slide_width=Inches(13.333)
            prs.slide_height=Inches(7.5)
            blank=prs.slide_layouts[6]
            for i,page in enumerate(doc):
                png=tmp/f"page-{i+1:05d}.png"
                pix=page.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False)
                pix.save(png)
                slide=prs.slides.add_slide(blank)
                slide.shapes.add_picture(str(png),0,0,width=prs.slide_width,height=prs.slide_height)
            prs.save(out)
        elif fmt == "epub":
            txt=tmp/"input.txt"
            run(["pdftotext","-layout",str(pdf),str(txt)])
            run(["pandoc",str(txt),"-f","plain","-t","epub","-o",str(out)])
        elif fmt == "html":
            run(["pdftohtml","-noframes","-hidden","-stdout",str(pdf)])
            with out.open("w",encoding="utf-8") as f:
                p=subprocess.run(["pdftohtml","-noframes","-hidden","-stdout",str(pdf)],check=True,text=True,capture_output=True)
                f.write(p.stdout)
        elif fmt == "md":
            txt=tmp/"input.txt"; run(["pdftotext","-layout",str(pdf),str(txt)])
            run(["pandoc",str(txt),"-f","plain","-t","markdown","-o",str(out)])
        elif fmt == "txt":
            run(["pdftotext","-layout",str(pdf),str(out)])
        elif fmt in {"odt","rtf"}:
            run(["libreoffice","--headless","--convert-to",fmt,"--outdir",str(tmp),str(pdf)])
            generated=tmp/(pdf.stem+"."+fmt)
            if not generated.exists(): raise RuntimeError(f"LibreOffice did not produce {fmt}")
            shutil.copy2(generated,out)
        else:
            raise SystemExit(f"unsupported format: {fmt}")

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("pdf",type=Path)
    ap.add_argument("--format",choices=sorted(FORMATS),required=True)
    ap.add_argument("--output",type=Path,required=True)
    args=ap.parse_args()
    args.output.parent.mkdir(parents=True,exist_ok=True)
    convert(args.pdf,args.format,args.output)
    print(json.dumps({
        "source_pdf": str(args.pdf),
        "source_sha256": sha256(args.pdf),
        "derived_format": args.format,
        "derived_file": str(args.output),
        "derived_bytes": args.output.stat().st_size,
        "canonical_pdf_unchanged": True
    },ensure_ascii=False))

if __name__=="__main__":
    main()
