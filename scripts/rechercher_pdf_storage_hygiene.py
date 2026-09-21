#!/usr/bin/env python3
"""Canonical PDF storage guard for all Rechercher PDF pools."""
from __future__ import annotations
import argparse
import hashlib
import re
from pathlib import Path

FORBIDDEN_SUFFIXES = (".pdf.enc", ".enc", ".encrypted")
HASHED_NAME = re.compile(r"^(?P<key>.+)--[0-9a-f]{12}$", re.IGNORECASE)

def is_real_pdf(path: Path) -> bool:
    try:
        with path.open("rb") as fh:
            return path.is_file() and path.stat().st_size > 0 and fh.read(5) == b"%PDF-"
    except OSError:
        return False

def logical_key(path: Path) -> str:
    m = HASHED_NAME.match(path.stem)
    return m.group("key") if m else path.stem

def sha256(path: Path) -> str:
    h=hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024*1024), b""):
            h.update(chunk)
    return h.hexdigest()

def clean(root: Path, pattern: str) -> int:
    removed=0
    for path in root.glob(pattern):
        if not path.is_file():
            continue
        if path.name.endswith(FORBIDDEN_SUFFIXES) or (path.suffix.lower()==".pdf" and not is_real_pdf(path)):
            path.unlink()
            removed += 1
    return removed

def canonicalize(root: Path, pattern: str) -> tuple[int,int]:
    groups={}
    for p in root.glob(pattern):
        if p.is_file() and p.suffix.lower()==".pdf" and is_real_pdf(p):
            groups.setdefault(logical_key(p), []).append(p)
    removed=0
    conflicts=0
    for key, paths in sorted(groups.items()):
        if len(paths)<=1:
            continue
        by_sha={}
        for p in paths:
            by_sha.setdefault(sha256(p),[]).append(p)
        for same in by_sha.values():
            if len(same)>1:
                keep=next((p for p in same if p.stem==key), sorted(same,key=lambda p:p.name)[0])
                for p in same:
                    if p != keep:
                        p.unlink(); removed += 1
        remaining=[p for p in root.glob(pattern) if p.is_file() and p.suffix.lower()==".pdf" and logical_key(p)==key and is_real_pdf(p)]
        if len(remaining)<=1:
            continue
        conflicts += 1
        keep=next((p for p in remaining if p.stem==key), None)
        if keep is None:
            keep=sorted(remaining,key=lambda p:(-p.stat().st_size,p.name))[0]
        target=root/f"{key}.pdf"
        for p in remaining:
            if p != keep:
                p.unlink(); removed += 1
        if keep != target:
            keep.rename(target)
    return removed,conflicts

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--root",required=True)
    ap.add_argument("--glob",action="append",required=True)
    ap.add_argument("--canonicalize",action="store_true")
    a=ap.parse_args()
    root=Path(a.root).resolve()
    removed=sum(clean(root,p) for p in a.glob)
    conflicts=0
    if a.canonicalize:
        for p in a.glob:
            r,c=canonicalize(root,p)
            removed += r; conflicts += c
    print(f"[PDF HYGIENE] removed={removed} logical_conflict_groups={conflicts}")

if __name__=="__main__":
    main()
