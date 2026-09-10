#!/usr/bin/env python3
"""Upgrade already-acquired books whose stored PDF scan is too poor.

The script preserves the existing book identity and file path, searches the
same broad candidate surface used by Rechercher, compares validated copies by
scan quality, and replaces a poor stored copy only when a materially better
acceptable copy is found. It never rewrites the source text or page layout.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import pathlib
import tempfile
from pathlib import Path
from urllib.request import Request, urlopen

from rechercher_pdf_quality import MIN_ACCEPT_SCORE, quality_gate, score_pdf

HERE = pathlib.Path(__file__).resolve().parent
ORIGINAL = HERE / "rechercher_no_match_retry_original.py"
spec = importlib.util.spec_from_file_location("rechercher_no_match_retry_original", ORIGINAL)
if spec is None or spec.loader is None:
    raise RuntimeError(f"cannot load preserved engine: {ORIGINAL}")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

MAX_BOOKS = 8
MAX_CANDIDATES = 6
_PDF_CACHE: dict[str, tuple[bytes, str, str]] = {}


def cached_fetch(url: str):
    cached = _PDF_CACHE.get(url)
    if cached is not None:
        return cached
    req = Request(url, headers={"User-Agent": getattr(mod, "UA", "DinAllah-Encyclopedia/Rechercher"), "Accept": "application/json,text/html,application/xhtml+xml,application/pdf,*/*"})
    with urlopen(req, timeout=getattr(mod, "TIMEOUT", 90)) as r:
        payload = (r.read(), (r.headers.get("Content-Type") or "").lower(), r.geturl())
    _PDF_CACHE[url] = payload
    if payload[2] != url:
        _PDF_CACHE[payload[2]] = payload
    return payload


mod.fetch = cached_fetch


def _pdf_files(vault: Path, book_id: str) -> list[Path]:
    prefix = f"{book_id}--"
    return sorted(p for p in vault.glob("*.pdf") if p.name.startswith(prefix))


def _best_existing(vault: Path, book_id: str):
    best = None
    for path in _pdf_files(vault, book_id):
        try:
            result = score_pdf(path)
        except Exception as exc:
            result = {"score": 0.0, "grade": "error", "accepted": False, "error": f"{type(exc).__name__}: {exc}"}
        row = (float(result.get("score", 0.0)), int(result.get("pages", 0)), path, result)
        if best is None or row[:2] > best[:2]:
            best = row
    return best


def _replace_manifest_item(rec: dict, path: Path, source: str, final_url: str, quality: dict, validation: str) -> None:
    acquired = list(rec.get("acquired") or [])
    new_item = {
        "source": source,
        "url": final_url,
        "bytes": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "validation": {"ok": True, "output": validation},
        "quality": quality,
        "status": "acquired_for_review",
        "local_path": str(path),
    }
    replaced = False
    for i, item in enumerate(acquired):
        if isinstance(item, dict) and Path(str(item.get("local_path", ""))).name == path.name:
            acquired[i] = new_item
            replaced = True
            break
    if not replaced:
        if acquired:
            acquired[0] = new_item
        else:
            acquired = [new_item]
    rec["acquired"] = acquired
    rec["acquired_count"] = len(acquired)
    rec["availability"] = "copy-acquired"
    rec["acquisition_state"] = "acquired"
    rec["quality_status"] = quality.get("grade")
    rec["quality_score"] = quality.get("score")


def process_book(rec: dict, vault: Path) -> dict:
    book_id = str(rec.get("id", ""))
    existing = _best_existing(vault, book_id)
    if existing is None:
        return {"id": book_id, "title": rec.get("title"), "result": "no-local-pdf"}
    current_score, current_pages, current_path, current_quality = existing
    row = {"id": book_id, "title": rec.get("title"), "current": {"file": current_path.name, "score": current_score, "grade": current_quality.get("grade"), "pages": current_pages}}
    if current_score >= MIN_ACCEPT_SCORE:
        _replace_manifest_item(rec, current_path, (rec.get("acquired") or [{}])[0].get("source", "existing") if isinstance((rec.get("acquired") or [{}])[0], dict) else "existing", (rec.get("acquired") or [{}])[0].get("url", "") if isinstance((rec.get("acquired") or [{}])[0], dict) else "", current_quality, json.dumps(current_quality, ensure_ascii=False))
        row["result"] = "already-acceptable"
        return row

    best = None
    seen_urls: set[str] = set()
    attempts = 0
    for engine, url in mod.candidates(rec):
        if url in seen_urls:
            continue
        seen_urls.add(url)
        attempts += 1
        if attempts > MAX_CANDIDATES:
            break
        try:
            pdf_urls = mod.page_pdf_candidates(url)
        except Exception:
            continue
        for pdf_url in pdf_urls[:12]:
            if pdf_url in seen_urls:
                continue
            seen_urls.add(pdf_url)
            try:
                raw, content_type, final_url = cached_fetch(pdf_url)
                with tempfile.NamedTemporaryFile(prefix="rechercher-quality-candidate-", suffix=".pdf", delete=False) as tmp:
                    temp_path = Path(tmp.name)
                    temp_path.write_bytes(raw)
                try:
                    ok, validation = mod.valid(temp_path)
                    if not ok:
                        continue
                    quality = score_pdf(temp_path)
                    candidate_key = (float(quality.get("score", 0.0)), int(quality.get("pages", 0)))
                    if candidate_key[0] < MIN_ACCEPT_SCORE:
                        continue
                    if best is None or candidate_key > best[0]:
                        best = (candidate_key, temp_path, engine, final_url, quality, validation, content_type)
                    elif temp_path.exists():
                        temp_path.unlink()
                except Exception:
                    if temp_path.exists():
                        temp_path.unlink()
            except Exception:
                continue
    if best is None:
        row["result"] = "no-better-copy"
        row["attempts"] = attempts
        return row

    _, temp_path, engine, final_url, quality, validation, _ = best
    try:
        temp_path.replace(current_path)
    finally:
        if temp_path.exists():
            temp_path.unlink()
    _replace_manifest_item(rec, current_path, f"quality-backfill:{engine}", final_url, quality, validation)
    row["result"] = "upgraded"
    row["new"] = {"file": current_path.name, "score": quality.get("score"), "grade": quality.get("grade"), "pages": quality.get("pages"), "source": engine, "url": final_url}
    row["attempts"] = attempts
    return row


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--manifest", required=True)
    p.add_argument("--vault", required=True)
    p.add_argument("--report", required=True)
    p.add_argument("--max-books", type=int, default=MAX_BOOKS)
    args = p.parse_args()
    manifest = Path(args.manifest)
    vault = Path(args.vault)
    report = Path(args.report)
    data = json.loads(manifest.read_text(encoding="utf-8"))
    records = data.get("records", [])
    targets = [r for r in records if r.get("availability") == "copy-acquired" and int(r.get("acquired_count", 0) or 0) > 0][:max(0, args.max_books)]
    stats = {"schema": "rechercher-pdf-quality-backfill/v1", "input_acquired": len(targets), "min_accept_score": MIN_ACCEPT_SCORE, "upgraded": 0, "already_acceptable": 0, "no_better_copy": 0, "no_local_pdf": 0, "results": []}
    for rec in targets:
        result = process_book(rec, vault)
        stats["results"].append(result)
        if result.get("result") == "upgraded": stats["upgraded"] += 1
        elif result.get("result") == "already-acceptable": stats["already_acceptable"] += 1
        elif result.get("result") == "no-better-copy": stats["no_better_copy"] += 1
        elif result.get("result") == "no-local-pdf": stats["no_local_pdf"] += 1
    counts = data.setdefault("counts", {})
    counts["acquired_books"] = sum(r.get("availability") == "copy-acquired" for r in records)
    counts["acquired_files"] = sum(int(r.get("acquired_count", 0) or 0) for r in records)
    data["schema"] = "developer-review-acquisition/v8"
    manifest.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(stats, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
