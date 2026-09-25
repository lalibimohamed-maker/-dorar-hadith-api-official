#!/usr/bin/env python3
"""Fail CI if a Rechercher path creates new encrypted PDF duplicates or deletes primary PDFs."""
from pathlib import Path
import re, sys

ROOT=Path(__file__).resolve().parents[1]
files=[]
for base, pats in [(".github/workflows", ("*.yml","*.yaml")), ("scripts", ("*.py","*.mjs","*.js","*.sh"))]:
    d=ROOT/base
    if d.exists():
        for pat in pats: files.extend(d.rglob(pat))
bad=[]
for path in sorted(set(files)):
    text=path.read_text(encoding="utf-8", errors="ignore")
    lines=text.splitlines()
    for i,line in enumerate(lines):
        low=line.lower()
        if "openssl enc" in low and "-d" not in low and ".enc" in low:
            bad.append((path,i+1,"new encryption command for PDF material"))
        if re.search(r"(?:^|\s)(?:mv|cp)\s+[^\n]*\.pdf\s+[^\n]*\.pdf\.enc",low):
            bad.append((path,i+1,"PDF -> PDF.ENC duplication"))
        if re.search(r"rm\s+-f(?:\s+--)?\s+[^\n]*\.pdf(?:['\"\s]|$)",low) and "historical" not in low and "legacy" not in low:
            bad.append((path,i+1,"primary PDF deletion"))
        if ".pdf.enc" in low and ("-out" in low or ">" in low) and "historical" not in low and "legacy" not in low:
            bad.append((path,i+1,"new PDF.ENC output"))
if bad:
    for p,n,msg in bad: print(f"PDF_STORAGE_POLICY_VIOLATION {p}:{n}: {msg}")
    raise SystemExit(1)
print(f"PDF_STORAGE_POLICY_OK files_scanned={len(set(files))}")
