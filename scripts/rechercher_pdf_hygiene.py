#!/usr/bin/env python3
"""Audit the recovered encyclopedia PDF corpus and quarantine only exact duplicates.

Safety rules:
- SHA-256 equality is mandatory for automatic duplicate handling.
- Automatic quarantine is allowed only when all matching files resolve to the
  same catalog/book identity through the authoritative acquisition manifest.
- Same title/author with different bytes is never deleted.
- Identical bytes mapped to different catalog identities are reported only.
- Quarantine is reversible and auditable; files are never irreversibly erased.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path


def norm(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"[\u064B-\u065F\u0670]", "", s)
    s = s.replace("ـ", "")
    s = re.sub(r"[إأآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه")
    s = re.sub(r"[^\w\u0600-\u06FF]+", " ", s, flags=re.UNICODE)
    return re.sub(r"\s+", " ", s).strip()


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def identity(rec: dict) -> str:
    for key in ("catalog_id", "book_id", "id", "work_id"):
        if rec.get(key):
            return str(rec[key])
    title = norm(str(rec.get("title", "")))
    author = norm(str(rec.get("author", "")))
    return f"title:{title}|author:{author}" if title or author else ""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--pdf-root", default="artifacts/developer-review-vault")
    ap.add_argument("--out", required=True)
    ap.add_argument("--quarantine", required=True)
    args = ap.parse_args()

    root = Path(args.root)
    pdf_root = root / args.pdf_root
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    records = manifest.get("records", [])

    by_path: dict[str, str] = {}
    for rec in records:
        rid = identity(rec)
        if not rid:
            continue
        for item in rec.get("acquired", []):
            raw = str(item.get("local_path", ""))
            if raw:
                p = Path(raw)
                by_path[p.name] = rid
                by_path[p.as_posix()] = rid
            if item.get("sha256"):
                by_path[f"sha:{item['sha256']}"] = rid

    files = sorted(p for p in pdf_root.rglob("*.pdf") if p.is_file())
    groups: dict[str, list[Path]] = {}
    invalid_pdf_files: list[str] = []
    for p in files:
        with p.open("rb") as f:
            signature = f.read(5)
        if signature != b"%PDF-":
            invalid_pdf_files.append(p.relative_to(pdf_root).as_posix())
            continue
        groups.setdefault(sha256(p), []).append(p)

    exact_duplicate_groups = []
    quarantined = []
    ambiguous = []
    untracked = []
    qroot = Path(args.quarantine)
    qroot.mkdir(parents=True, exist_ok=True)

    for digest, paths in sorted(groups.items()):
        if len(paths) == 1:
            p = paths[0]
            if not (by_path.get(p.name) or by_path.get(p.as_posix()) or by_path.get(f"sha:{digest}")):
                untracked.append(p.relative_to(pdf_root).as_posix())
            continue

        ids = {
            by_path.get(p.name)
            or by_path.get(p.as_posix())
            or by_path.get(f"sha:{digest}")
            for p in paths
        }
        ids.discard(None)
        group = {
            "sha256": digest,
            "files": [p.relative_to(pdf_root).as_posix() for p in paths],
            "catalog_identities": sorted(ids),
        }
        exact_duplicate_groups.append(group)

        # Only one catalog identity means these are provably redundant copies.
        if len(ids) == 1:
            canonical = paths[0]
            for p in paths[1:]:
                relative = p.relative_to(pdf_root)
                target = qroot / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                if target.exists():
                    target = target.with_name(f"{target.stem}.{digest[:12]}{target.suffix}")
                shutil.move(str(p), str(target))
                quarantined.append({
                    "file": relative.as_posix(),
                    "canonical": canonical.relative_to(pdf_root).as_posix(),
                    "sha256": digest,
                    "quarantine": str(target),
                })
        else:
            ambiguous.append(group)

    remaining = sorted(p.relative_to(pdf_root).as_posix() for p in pdf_root.rglob("*.pdf") if p.is_file())
    report = {
        "schema": "din-allah-encyclopedia/pdf-hygiene/v2",
        "scope": {
            "pdf_root": args.pdf_root,
            "recursive": True,
            "whole_recovered_encyclopedia_vault": True,
        },
        "policy": {
            "automatic_delete": "none",
            "safe_duplicate_action": "quarantine_exact_sha256_duplicate_same_catalog_identity_only",
            "near_duplicates": "report_only",
            "same_bytes_different_catalog_identity": "report_only",
            "untracked_pdfs": "report_only",
            "quarantine": "reversible_and_auditable",
        },
        "counts": {
            "pdf_files_scanned": len(files),
            "valid_pdf_files": len(files) - len(invalid_pdf_files),
            "invalid_pdf_signatures": len(invalid_pdf_files),
            "unique_sha256_groups": len(groups),
            "exact_duplicate_groups": len(exact_duplicate_groups),
            "safe_redundant_copies_quarantined": len(quarantined),
            "ambiguous_duplicate_groups": len(ambiguous),
            "untracked_pdf_files": len(untracked),
            "remaining_active_pdfs": len(remaining),
        },
        "invalid_pdf_files": invalid_pdf_files,
        "exact_duplicate_groups": exact_duplicate_groups,
        "quarantined": quarantined,
        "ambiguous": ambiguous,
        "untracked_pdf_files": untracked,
        "remaining_active_pdfs": remaining,
    }
    Path(args.out).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report["counts"], ensure_ascii=False))
    return 0 if not invalid_pdf_files else 1


if __name__ == "__main__":
    raise SystemExit(main())
