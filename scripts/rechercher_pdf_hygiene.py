#!/usr/bin/env python3
"""Audit a PDF corpus and remove only provably redundant exact duplicates.

Rules:
- SHA-256 equality is the only automatic deletion criterion.
- A duplicate is deleted only when its hash is already represented by an earlier
  file with the same normalized catalog identity, or when the manifest maps both
  files to the same book identity.
- Same title/author but different bytes are reported, never deleted.
- Different catalog identities sharing identical bytes are reported as a
  possible catalog duplication and are NOT deleted automatically.
"""
from __future__ import annotations
import argparse, hashlib, json, re, shutil
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
    ap.add_argument("--out", required=True)
    ap.add_argument("--quarantine", required=True)
    args = ap.parse_args()

    root = Path(args.root)
    pdf_root = root / "artifacts/developer-review-vault"
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    records = manifest.get("records", [])

    by_path = {}
    by_id = {}
    for rec in records:
        rid = identity(rec)
        if rid:
            by_id[rid] = rec
        for item in rec.get("acquired", []):
            p = Path(item.get("local_path", ""))
            by_path[p.name] = rid
            by_path[p.as_posix()] = rid
            if item.get("sha256"):
                by_path[f"sha:{item['sha256']}"] = rid

    files = sorted(pdf_root.glob("*.pdf"))
    groups = {}
    for p in files:
        if p.read_bytes()[:5] != b"%PDF-":
            continue
        groups.setdefault(sha256(p), []).append(p)

    exact_duplicate_groups = []
    deleted = []
    ambiguous = []
    kept = []
    qroot = Path(args.quarantine)
    qroot.mkdir(parents=True, exist_ok=True)

    for digest, paths in sorted(groups.items()):
        if len(paths) == 1:
            kept.append(paths[0].name)
            continue
        ids = {by_path.get(p.name) or by_path.get(p.as_posix()) or by_path.get(f"sha:{digest}") for p in paths}
        ids.discard(None)
        group = {"sha256": digest, "files": [p.name for p in paths], "catalog_identities": sorted(ids)}
        exact_duplicate_groups.append(group)
        if len(ids) == 1:
            canonical = paths[0]
            for p in paths[1:]:
                # Move redundant copy out of the active corpus; preserve an auditable record.
                target = qroot / p.name
                if target.exists():
                    target = qroot / f"{p.stem}.{digest[:12]}{p.suffix}"
                shutil.move(str(p), str(target))
                deleted.append({"file": p.name, "canonical": canonical.name, "sha256": digest, "quarantine": str(target)})
            kept.append(canonical.name)
        else:
            ambiguous.append(group)
            kept.extend(p.name for p in paths)

    report = {
        "schema": "din-allah-encyclopedia/pdf-hygiene/v1",
        "policy": {
            "automatic_delete": "exact_sha256_duplicate_same_catalog_identity_only",
            "near_duplicates": "report_only",
            "same_bytes_different_catalog_identity": "report_only",
            "quarantine": "redundant copies are moved, not irreversibly erased"
        },
        "counts": {
            "pdf_files_scanned": len(files),
            "unique_sha256_groups": len(groups),
            "exact_duplicate_groups": len(exact_duplicate_groups),
            "safe_redundant_copies_quarantined": len(deleted),
            "ambiguous_duplicate_groups": len(ambiguous),
            "remaining_active_pdfs": len(list(pdf_root.glob("*.pdf")))
        },
        "exact_duplicate_groups": exact_duplicate_groups,
        "quarantined": deleted,
        "ambiguous": ambiguous,
    }
    Path(args.out).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report["counts"], ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
