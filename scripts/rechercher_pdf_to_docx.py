#!/usr/bin/env python3
import argparse, hashlib, json, os, re, sys, unicodedata, zipfile
from pathlib import Path
import xml.etree.ElementTree as ET
import pymupdf
from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.shared import Inches
from bidi.algorithm import get_display
import arabic_reshaper

ARABIC_RE=re.compile(r"[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]")
ARABIC_DIACRITICS_RE=re.compile(r"[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]")
PUA_RE=re.compile(r"[\ue000-\uf8ff\U000f0000-\U000ffffd\U00100000-\U0010fffd]")
MOJIBAKE_RE=re.compile(r"(?:Ã.|Ø.|Ù.|â€|ï»¿|�)")
MAX_INPUT_MB=int(os.environ.get("RECHERCHER_PDF_DOCX_MAX_MB","50"))
KNOWN_ISLAMIC_LIGATURES={"ﷲ":"ﷲ","ﷳ":"ﷳ","ﷴ":"ﷴ","ﷵ":"ﷵ","ﷶ":"ﷶ","ﷷ":"ﷷ","ﷸ":"ﷸ","ﷹ":"ﷹ","ﷺ":"ﷺ","ﷻ":"ﷻ","﷼":"﷼","﷽":"﷽"}
INVALID_XML_RE=re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\ud800-\udfff\ufffe\uffff]")
ARABIC_STOP={"و","في","من","على","إلى","عن","أن","إن","ما","لا","لم","لن","هو","هي","هذا","هذه","ذلك","التي","الذي","ثم"}
ARABIC_HINTS={"الله","رسول","محمد","قال","عن","حدثنا","أخبرنا","كتاب","باب","قالت","صلى","عليه","وسلم","تعالى","الحديث","القرآن"}

def sha256(p):
    h=hashlib.sha256()
    with open(p,"rb") as f:
        for b in iter(lambda:f.read(1048576),b""): h.update(b)
    return h.hexdigest()

def sanitize_xml_text(s):
    return INVALID_XML_RE.sub("",s.replace("\r\n","\n").replace("\r","\n"))

def protect_symbols(s):
    return "".join(KNOWN_ISLAMIC_LIGATURES.get(c,c) for c in unicodedata.normalize("NFC",s))

def pua_info(s):
    vals=sorted(set(ord(c) for c in s if PUA_RE.match(c)))
    return {"detected":bool(vals),"codepoints":[f"U+{v:04X}" for v in vals],"unknown":bool(vals)}

def norm_for_compare(s):
    s=protect_symbols(s)
    s=unicodedata.normalize("NFC",s)
    s=ARABIC_DIACRITICS_RE.sub("",s)
    s=re.sub(r"\s+"," ",s).strip()
    return s

def levenshtein_ratio(a,b):
    a,b=norm_for_compare(a),norm_for_compare(b)
    if a==b: return 0.0
    if not a: return 1.0 if b else 0.0
    if not b: return 1.0
    if len(a)>len(b): a,b=b,a
    prev=list(range(len(a)+1))
    for j,cb in enumerate(b,1):
        cur=[j]
        for i,ca in enumerate(a,1):
            cur.append(min(cur[-1]+1,prev[i]+1,prev[i-1]+(ca!=cb)))
        prev=cur
    return round(prev[-1]/max(len(a),len(b)),6)

def token_metrics(a,b):
    def toks(s):
        return [x for x in re.findall(r"[\w\u0600-\u06ff]+",norm_for_compare(s)) if x not in ARABIC_STOP]
    aa,bb=toks(a),toks(b)
    aset,bset=set(aa),set(bb)
    return {"source_tokens":len(aa),"derived_tokens":len(bb),
            "preserved_unique_token_ratio":round(len(aset&bset)/max(1,len(aset)),6)}

def visual_order_candidate(text):
    if not ARABIC_RE.search(text): return {"applied":False,"confidence":0.0,"reason":"non-arabic"}
    logical=get_display(text)
    if logical==text: return {"applied":False,"confidence":0.0,"reason":"already-logical-or-ambiguous"}
    def score(s):
        words=re.findall(r"[\u0600-\u06ff]{2,}",s)
        return sum(w in ARABIC_HINTS for w in words)*3 + sum(1 for w in words if len(w)>=3)
    shaped=arabic_reshaper.reshape(text)
    shaped_logical=arabic_reshaper.reshape(logical)
    before=score(text); after=score(logical)
    shaping_delta=(shaped_logical.count("ﻻ")+shaped_logical.count("ﷲ"))-(shaped.count("ﻻ")+shaped.count("ﷲ"))
    conf=0.0
    if after>before: conf=0.88
    elif after==before and shaping_delta>0: conf=0.72
    if conf>=0.85:
        return {"applied":True,"confidence":conf,"reason":"high-confidence visual-order recovery","text":logical}
    return {"applied":False,"confidence":conf,"reason":"ambiguous; preserved logical text"}

def set_rtl(p,v):
    pPr=p._p.get_or_add_pPr(); old=pPr.find(qn("w:bidi"))
    if v and old is None:
        el=OxmlElement("w:bidi"); el.set(qn("w:val"),"1"); pPr.append(el)
    elif not v and old is not None: pPr.remove(old)

def set_font(r,name):
    rPr=r._r.get_or_add_rPr(); rf=rPr.find(qn("w:rFonts"))
    if rf is None: rf=OxmlElement("w:rFonts"); rPr.append(rf)
    for a in ("ascii","hAnsi","cs","eastAsia"): rf.set(qn("w:"+a),name)

def configure_styles(d):
    normal=d.styles["Normal"]
    normal.font.name="Arial"
    normal._element.rPr.rFonts.set(qn("w:ascii"),"Arial")
    normal._element.rPr.rFonts.set(qn("w:hAnsi"),"Arial")
    normal._element.rPr.rFonts.set(qn("w:eastAsia"),"Arial")
    normal._element.rPr.rFonts.set(qn("w:cs"),"Amiri")
    try:
        arabic=d.styles["Rechercher Arabic"]
    except KeyError:
        arabic=d.styles.add_style("Rechercher Arabic",1)
    arabic.font.name="Amiri"
    arabic._element.rPr.rFonts.set(qn("w:ascii"),"Arial")
    arabic._element.rPr.rFonts.set(qn("w:hAnsi"),"Arial")
    arabic._element.rPr.rFonts.set(qn("w:eastAsia"),"Arial")
    arabic._element.rPr.rFonts.set(qn("w:cs"),"Amiri")

def discover_tessdata():
    candidates=[]
    env=os.environ.get("TESSDATA_PREFIX")
    if env: candidates.append(Path(env))
    try:
        detected=pymupdf.get_tessdata()
        if detected: candidates.append(Path(detected))
    except Exception:
        pass
    candidates += [Path("/usr/share/tesseract-ocr/5/tessdata"),
                   Path("/usr/share/tesseract-ocr/4.00/tessdata"),
                   Path("/usr/share/tesseract/tessdata"),
                   Path("/usr/share/tessdata")]
    for p in candidates:
        if (p/"ara.traineddata").is_file():
            os.environ["TESSDATA_PREFIX"]=str(p)
            return str(p)
    raise RuntimeError("Arabic Tesseract data not found: ara.traineddata")

def configure_ocr_environment():
    tessdata=discover_tessdata()
    os.environ.setdefault("OMP_THREAD_LIMIT",os.environ.get("RECHERCHER_OCR_THREADS","1"))
    return tessdata

def add_text(d,text):
    text=sanitize_xml_text(protect_symbols(text))
    if not text.strip(): return
    p=d.add_paragraph(); ar=bool(ARABIC_RE.search(text)); set_rtl(p,ar)
    r=p.add_run(text); set_font(r,"Amiri" if ar else "Arial")

def bbox_overlap(a,b):
    ax0,ay0,ax1,ay1=a; bx0,by0,bx1,by1=b
    ix=max(0,min(ax1,bx1)-max(ax0,bx0)); iy=max(0,min(ay1,by1)-max(ay0,by0))
    return ix*iy/max(1,(ax1-ax0)*(ay1-ay0))

def table_bboxes(page):
    try:
        finder=page.find_tables()
        tables=list(finder.tables)
        if not tables:
            finder=page.find_tables(strategy="text")
            tables=list(finder.tables)
        return tables
    except Exception:
        return []

def _extract_text_blocks(page, sort=True):
    data=page.get_text("dict",sort=sort)
    text_blocks=[]; image_blocks=[]
    for b in data.get("blocks",[]):
        bbox=tuple(b.get("bbox",(0,0,0,0)))
        if b.get("type")==0:
            text="\n".join("".join(span.get("text","") for span in line.get("spans",[])) for line in b.get("lines",[])).strip()
            if text: text_blocks.append({"bbox":bbox,"text":text,"kind":"digital"})
        elif b.get("type")==1:
            image_blocks.append({"bbox":bbox,"kind":"image"})
    return text_blocks,image_blocks

def _order_blocks_reading(blocks,page_width):
    if len(blocks)<2: return blocks
    xs=sorted(set(round(b["bbox"][0],1) for b in blocks))
    gaps=[xs[i+1]-xs[i] for i in range(len(xs)-1)]
    threshold=max(18.0,page_width*0.045)
    candidates=[g for g in gaps if g>=threshold]
    if not candidates: return sorted(blocks,key=lambda b:(b["bbox"][1],b["bbox"][0]))
    split=max(candidates); cut=xs[gaps.index(split)+1]
    left=[b for b in blocks if b["bbox"][0]<cut]; right=[b for b in blocks if b["bbox"][0]>=cut]
    if not left or not right: return sorted(blocks,key=lambda b:(b["bbox"][1],b["bbox"][0]))
    coverage=lambda g:(max(b["bbox"][2] for b in g)-min(b["bbox"][0] for b in g))/max(1,page_width)
    if min(coverage(left),coverage(right))<0.22:
        return sorted(blocks,key=lambda b:(b["bbox"][1],b["bbox"][0]))
    # Arabic layout: finish the right column top-to-bottom, then the left column.
    return [b for col in (sorted(right,key=lambda b:(b["bbox"][1],-b["bbox"][0])),
                          sorted(left,key=lambda b:(b["bbox"][1],-b["bbox"][0]))) for b in col]

def _set_row_cant_split(row):
    trPr=row._tr.get_or_add_trPr()
    if trPr.find(qn("w:cantSplit")) is None: trPr.append(OxmlElement("w:cantSplit"))

def _configure_table(tbl,cols):
    tbl.autofit=False; tbl.alignment=WD_TABLE_ALIGNMENT.RIGHT
    width=max(1.0,6.5/max(1,cols))
    for row in tbl.rows:
        _set_row_cant_split(row)
        for cell in row.cells:
            cell.width=Inches(width); cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
            for para in cell.paragraphs:
                para.alignment=WD_ALIGN_PARAGRAPH.RIGHT; set_rtl(para,True)
                for run in para.runs: set_font(run,"Amiri")

def page_regions(page,tessdata):
    text_blocks,image_blocks=_extract_text_blocks(page,sort=True)
    drawings=page.get_drawings()
    vector_fallback=not text_blocks and not image_blocks and bool(drawings)
    out=list(text_blocks); ocr_count=0
    if image_blocks or vector_fallback:
        try:
            tp=page.get_textpage_ocr(language=os.environ.get("RECHERCHER_OCR_LANG","ara"),
                                     dpi=int(os.environ.get("RECHERCHER_OCR_DPI","200")),
                                     full=vector_fallback,tessdata=tessdata)
            ocr_data=page.get_text("dict",textpage=tp,sort=True)
            for b in ocr_data.get("blocks",[]):
                if b.get("type")!=0: continue
                bbox=tuple(b.get("bbox",(0,0,0,0)))
                text="\n".join("".join(span.get("text","") for span in line.get("spans",[])) for line in b.get("lines",[])).strip()
                fonts=[span.get("font","") for line in b.get("lines",[]) for span in line.get("spans",[])]
                if not text or (not vector_fallback and not any("GlyphLessFont" in f for f in fonts)): continue
                if not vector_fallback and any(bbox_overlap(bbox,t["bbox"])>0.65 for t in text_blocks): continue
                out.append({"bbox":bbox,"text":text,"kind":"ocr-vector" if vector_fallback else "ocr"}); ocr_count+=1
        except Exception:
            pass
    return _order_blocks_reading(out,page.rect.width),ocr_count,len(text_blocks),len(image_blocks),vector_fallback

def validate_docx(path):
    try:
        p=Path(path)
        if not p.is_file() or p.stat().st_size < MIN_DOCX_BYTES: return False
        if not zipfile.is_zipfile(p): return False
        with zipfile.ZipFile(p) as z:
            names=set(z.namelist())
            required={"[Content_Types].xml","word/document.xml"}
            if not required.issubset(names): return False
            for n in required: ET.fromstring(z.read(n))
            ET.fromstring(z.read("word/document.xml"))
        return True
    except (OSError, zipfile.BadZipFile, ET.ParseError):
        return False

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--input",required=True); ap.add_argument("--output",required=True); ap.add_argument("--manifest",required=True); ap.add_argument("--strict",action="store_true")
    a=ap.parse_args(); inp=Path(a.input); out=Path(a.output); out.mkdir(parents=True,exist_ok=True); entries=[]
    for pdf in sorted(inp.rglob("*.pdf")):
        e={"source_pdf":str(pdf),"status":"failed","content_policy":"preserve-verbatim","derivation":"pdf-structural-extraction","review_status":"review-required","sacred_text_flag":"requires_review","arabic_alignment_verified":False,"ocr_used":False,"text_repair_applied":False}
        try:
            if pdf.stat().st_size>MAX_INPUT_MB*1048576:
                e.update(status="deferred-large-file",reason=f"input exceeds {MAX_INPUT_MB} MiB"); entries.append(e); continue
            e["source_pdf_sha256"]=sha256(pdf); doc=pymupdf.open(pdf); d=Document(); configure_styles(d); tessdata=configure_ocr_environment(); all_source=[]; all_derived=[]; all_derived_digital=[]; table_metrics=[]; pstats=[]
            for page_no,page in enumerate(doc,1):
                regions,oc,dc,ic,vector_fallback=page_regions(page,tessdata)
                tables=table_bboxes(page)
                for table in tables:
                    rows=table.extract()
                    if not rows:
                        continue
                    cols=max(len(r) for r in rows)
                    tbl=d.add_table(rows=len(rows),cols=cols)
                    tbl.style="Table Grid"
                    for ri,row in enumerate(rows):
                        for ci,val in enumerate(row):
                            txt=sanitize_xml_text(protect_symbols(val or ""))
                            cell=tbl.cell(ri,ci)
                            cell.text=txt
                            is_ar=bool(ARABIC_RE.search(txt))
                            for para in cell.paragraphs:
                                set_rtl(para,is_ar)
                                for run in para.runs:
                                    set_font(run,"Amiri" if is_ar else "Arial")
                    _configure_table(tbl,cols)
                    table_metrics.append({
                        "page":page_no,
                        "bbox":[float(x) for x in table.bbox],
                        "rows":len(rows),
                        "columns":cols,
                        "source_text":"\n".join(" | ".join((x or "") for x in row) for row in rows)
                    })
                table_rects=[tuple(float(x) for x in t.bbox) for t in tables]
                is_table=lambda r:any(bbox_overlap(r["bbox"],tb)>0.5 for tb in table_rects)
                page_source="\n".join(r["text"] for r in regions if r["kind"]=="digital" and not is_table(r)); page_derived=[]; page_derived_digital=[]
                for r in regions:
                    original=r["text"]; repair=visual_order_candidate(original); text=repair.get("text",original) if repair["applied"] else original
                    text=sanitize_xml_text(protect_symbols(text)); page_derived.append(text);\n                    if r["kind"]=="digital" and not is_table(r): page_derived_digital.append(text)\n                    add_text(d,text)
                    if repair["applied"]: e["text_repair_applied"]=True
                    pi=pua_info(original)
                    if pi["detected"]: e.setdefault("pua",{"detected":True,"codepoints":[]}); e["pua"]["codepoints"]=sorted(set(e["pua"]["codepoints"]+pi["codepoints"]))
                all_source.append(page_source); all_derived.append("\n".join(page_derived)); all_derived_digital.append("\n".join(page_derived_digital))
                pstats.append({"page":page_no,"digital_blocks":dc,"image_blocks":ic,"ocr_blocks":oc,"ocr_used":oc>0,"vector_fallback":vector_fallback})
                e["ocr_used"]=e["ocr_used"] or oc>0
                if vector_fallback: e["sacred_text_flag"]="requires_review"; e["review_status"]="review-required"
            source_digital="\n".join(all_source); derived_text="\n".join(all_derived); derived_digital="\n".join(all_derived_digital)
            digital_chars=len(source_digital); derived_chars=len(derived_text)
            image_pages=sum(1 for x in pstats if x["image_blocks"] and x["digital_blocks"]==0)
            hybrid_pages=sum(1 for x in pstats if x["image_blocks"] and x["digital_blocks"])
            if digital_chars==0 and image_pages: kind="scanned"
            elif hybrid_pages or (image_pages and digital_chars): kind="hybrid"
            else: kind="digital-native"
            e.update(pdf_kind=kind,source_char_count=digital_chars,derived_char_count=derived_chars,derived_digital_char_count=len(derived_digital),page_statistics=pstats,vector_fallback_pages=vector_pages,tessdata=tessdata,table_metrics=table_metrics)
            if digital_chars:
                e["loss_ratio"]=levenshtein_ratio(source_digital,derived_digital)
                e["comparison_mode"]="normalized-levenshtein"
                e["token_metrics"]=token_metrics(source_digital,derived_digital)
            else:
                e["loss_ratio"]=None; e["comparison_mode"]="not-comparable-ocr-only"
            e["mojibake_detected"]=bool(MOJIBAKE_RE.search(derived_text))
            if e["mojibake_detected"]: e["review_status"]="review-required"
            if e.get("pua",{}).get("detected"): e["review_status"]="review-required"
            target=out/(pdf.relative_to(inp).with_suffix(".docx")); target.parent.mkdir(parents=True,exist_ok=True); d.save(target)
            e["derived_docx"]=str(target); e["derived_docx_sha256"]=sha256(target); e["arabic_alignment_verified"]=bool(digital_chars and not e["text_repair_applied"] and not e.get("mojibake_detected",False))
            e["quality_validation"]={"docx_package":validate_docx(target),"loss_ratio":e["loss_ratio"],"paragraphs":len(d.paragraphs),"xml_safe":validate_docx(target)}
            if not e["quality_validation"]["docx_package"]: raise ValueError("DOCX package/XML validation failed")
            e["status"]="converted"; doc.close()
        except Exception as x: e["error"]=str(x)
        entries.append(e)
    m={"schema":"rechercher/pdf-to-docx/v3","converter":"PyMuPDF+python-docx","policy":"derived-only; source PDFs are never modified or deleted","max_input_mb":MAX_INPUT_MB,"visual_order":"conservative python-bidi detector; arabic-reshaper used only for detection scoring","loss_metric":"normalized Levenshtein distance with Arabic diacritics ignored for comparison only; original text is preserved","hybrid_policy":"one partial OCR TextPage per page; OCR blocks merged by coordinates; tables isolated from text-loss metrics","pua_policy":"known Islamic ligatures preserved; unknown PUA is retained and marked review-required","files":entries,"total_pdfs":len(entries),"converted":sum(e["status"]=="converted" for e in entries),"deferred_large_files":sum(e["status"]=="deferred-large-file" for e in entries),"failed":sum(e["status"]=="failed" for e in entries)}
    Path(a.manifest).write_text(json.dumps(m,ensure_ascii=False,indent=2)+"\n",encoding="utf-8"); print(json.dumps({k:m[k] for k in ("total_pdfs","converted","deferred_large_files","failed")},ensure_ascii=False)); return 1 if a.strict and m["failed"] else 0
if __name__=="__main__": sys.exit(main())
