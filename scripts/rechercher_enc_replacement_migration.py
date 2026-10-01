#!/usr/bin/env python3
"""Replace encrypted Rechercher vault assets only after a verified external PDF is stored.

Policy:
- A .pdf.enc is NEVER deleted merely because it can be decrypted.
- A replacement must be a real PDF downloaded from an external source.
- Internet Archive is used as the first automated replacement source.
- Redistribution is accepted automatically only for explicit public-domain/CC
  licenses; everything else is retained for manual rights review.
- The replacement PDF is validated and hashed before the encrypted source is
  marked deletable.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path

IA_SEARCH = "https://archive.org/advancedsearch.php"
IA_META = "https://archive.org/metadata/{identifier}"
IA_FILE = "https://archive.org/download/{identifier}/{filename}"

SAFE_LICENSE_MARKERS = (
    "creativecommons.org/publicdomain",
    "creativecommons.org/licenses/by/",
    "creativecommons.org/licenses/by-sa/",
    "creativecommons.org/share-your-work/public-domain",
)

def clean_title(name: str) -> str:
    s = re.sub(r"\.pdf\.enc$", "", name, flags=re.I)
    s = re.sub(r"[_-]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def valid_pdf(path: Path) -> bool:
    try:
        with path.open("rb") as fh:
            if path.stat().st_size <= 0 or fh.read(5) != b"%PDF-":
                return False
        q = subprocess.run(["qpdf", "--check", str(path)], capture_output=True, text=True)
        return q.returncode == 0
    except OSError:
        return False

def ia_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "Rechercher/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def find_candidate(title: str) -> tuple[dict | None, str | None, str | None]:
    # Search exact-ish title first; do not broaden to arbitrary unrelated PDFs.
    q = 'mediatype:texts AND title:"' + title.replace('"', " ") + '"'
    url = IA_SEARCH + "?" + urllib.parse.urlencode({
        "q": q, "fl[]": ["identifier,title,creator,licenseurl,rights"],
        "rows": 10, "page": 1, "output": "json"
    }, doseq=True)
    data = ia_json(url)
    docs = data.get("response", {}).get("docs", [])
    needle = re.sub(r"\W+", " ", title.lower()).strip()
    best = None
    for doc in docs:
        got = re.sub(r"\W+", " ", str(doc.get("title", "")).lower()).strip()
        if needle and (needle == got or needle in got or got in needle):
            best = doc
            break
    if not best:
        return None, None, None
    ident = best.get("identifier")
    if not ident:
        return None, None, None
    meta = ia_json(IA_META.format(identifier=urllib.parse.quote(str(ident), safe="")))
    md = meta.get("metadata", {})
    license_url = str(md.get("licenseurl") or best.get("licenseurl") or "").lower()
    rights = str(md.get("rights") or "").lower()
    if not any(m in license_url for m in SAFE_LICENSE_MARKERS) and "public domain" not in rights:
        return None, str(ident), "rights-not-verified"
    for f in meta.get("files", []):
        fn = str(f.get("name", ""))
        fmt = str(f.get("format", "")).lower()
        if fn.lower().endswith(".pdf") and (f.get("source") in (None, "original") or "pdf" in fmt):
            return meta, str(ident), fn
    return None, str(ident), "no-pdf"

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--encrypted-root", required=True)
    ap.add_argument("--pdf-root", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    enc_root = Path(args.encrypted_root)
    pdf_root = Path(args.pdf_root)
    pdf_root.mkdir(parents=True, exist_ok=True)
    records = []

    for enc in sorted(enc_root.rglob("*.pdf.enc")):
        title = clean_title(enc.name)
        rec = {"encrypted": str(enc), "title": title, "status": "retained"}
        try:
            meta, ident, pdf_name = find_candidate(title)
            rec["source_identifier"] = ident
            if meta is None or not pdf_name:
                rec["reason"] = pdf_name or "no-verified-replacement"
                records.append(rec)
                continue
            dest = pdf_root / (enc.name[:-4])  # .pdf.enc -> .pdf
            url = IA_FILE.format(identifier=urllib.parse.quote(ident, safe=""), filename=urllib.parse.quote(pdf_name, safe="/"))
            urllib.request.urlretrieve(url, dest)
            if not valid_pdf(dest):
                dest.unlink(missing_ok=True)
                rec["reason"] = "downloaded-file-failed-pdf-validation"
                records.append(rec)
                continue
            rec.update({
                "replacement_pdf": str(dest),
                "source_url": url,
                "sha256": sha256(dest),
                "status": "replacement_verified",
                "deletable": True,
            })
        except Exception as exc:
            rec["reason"] = f"replacement-search-error:{type(exc).__name__}"
        records.append(rec)

    report = {
        "schema": "din-allah-encyclopedia/encrypted-replacement/v1",
        "policy": {
            "encrypted_delete_requires_verified_replacement": True,
            "external_pdf_required": True,
            "rights_required": True,
            "no_corpus_write": True,
        },
        "counts": {
            "encrypted_scanned": len(records),
            "replacement_verified": sum(r["status"] == "replacement_verified" for r in records),
            "retained": sum(r["status"] != "replacement_verified" for r in records),
        },
        "records": records,
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["counts"], ensure_ascii=False))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
