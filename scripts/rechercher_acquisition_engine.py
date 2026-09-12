#!/usr/bin/env python3
"""Independent Rechercher real-PDF acquisition engine.

This is the only execution engine used by the whole-encyclopedia queue and
vault recovery workflow.  It intentionally has no dependency on the legacy
Waqfeya worker or the old PDF wrapper.

Contract:
- acquire real .pdf files only; reject .pdf.enc;
- merge duplicate catalog overlays before acquisition;
- require acquisition-critical metadata without raising raw KeyError;
- validate and repair PDFs with qpdf;
- apply the canonical PDF quality/completeness gate before promotion;
- compare reachable catalogued candidates and retain the best-quality PDF;
- preserve provenance, hashes and rights state;
- never advance a book to acquired unless every expected volume is real and valid.
"""
from __future__ import annotations

import argparse
import html
import json
import math
import os
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import quote, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen

from rechercher_pdf_quality_gate import inspect as inspect_pdf

parser = argparse.ArgumentParser()
parser.add_argument("--root", default=None)
ARGS = parser.parse_args()
ROOT = Path(ARGS.root).resolve() if ARGS.root else Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts"
ART.mkdir(exist_ok=True)
USER_AGENT = "DinAllah-Encyclopedia/1.3"
DOWNLOAD_TIMEOUT = 120
MAX_SOURCE_ATTEMPTS = max(12, int(os.environ.get("RECHERCHER_MAX_SOURCE_ATTEMPTS", "24")))
MAX_BOOK_WORKERS = max(1, min(int(os.environ.get("RECHERCHER_MAX_BOOK_WORKERS", "12")), 32))
REEVALUATE_EXISTING = os.environ.get("RECHERCHER_REEVALUATE_EXISTING", "0") == "1"


def book_key(book):
    title = str(book.get("title") or book.get("titleAr") or "").strip().casefold()
    return str(book.get("id") or f"title:{title}")


def redistribution_is_allowed(book):
    return book.get("redistribution_status") == "verified-redistributable" or book.get("rights_status") == "verified-redistributable"


def rights_state(book):
    if redistribution_is_allowed(book):
        return "verified-redistributable"
    if book.get("rights_status") or book.get("redistribution_status") or book.get("acquisition_status"):
        return "rights-review-required"
    return "rights-unknown-protected-private"


def normalize_url(url):
    p = urlsplit(str(url))
    return urlunsplit((p.scheme, p.netloc, quote(p.path, safe="/%:@-._~"), p.query, p.fragment))


def fetch(url):
    req = Request(normalize_url(url), headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def pdf_links(page, base):
    out, seen = [], set()
    for m in re.finditer(r'href=[\"\']([^\"\']+)[\"\']', page, re.I):
        u = normalize_url(urljoin(base, html.unescape(m.group(1))))
        if re.search(r"\.pdf(?:\?|$)", u, re.I) and not re.search(r"\.pdf\.enc(?:\?|$)", u, re.I) and u not in seen:
            seen.add(u)
            out.append(u)
    return out


def qpdf_check(path):
    p = subprocess.run(["qpdf", "--check", str(path)], text=True, capture_output=True)
    return p.returncode, (p.stdout + p.stderr).strip()


def validate_and_repair(path):
    status, output = qpdf_check(path)
    if status == 0:
        return {"status": "valid", "repaired": False, "initial_check": output, "repair_check": None}
    if status == 2:
        return {"status": "invalid", "repaired": False, "initial_check": output, "repair_check": None, "reason": "qpdf_errors"}
    if status != 3:
        return {"status": "invalid", "repaired": False, "initial_check": output, "repair_check": None, "reason": f"qpdf_exit_{status}"}
    original = path.with_name(path.name + ".pre-repair")
    try:
        path.rename(original)
        repair = subprocess.run(["qpdf", str(original), "--replace-input"], text=True, capture_output=True)
        if repair.returncode not in (0, 3):
            return {"status": "invalid", "repaired": False, "initial_check": output, "repair_check": (repair.stdout + repair.stderr).strip(), "reason": f"repair_exit_{repair.returncode}"}
        status2, output2 = qpdf_check(original)
        if status2 == 0:
            original.rename(path)
            return {"status": "repaired", "repaired": True, "initial_check": output, "repair_check": output2}
        return {"status": "invalid", "repaired": False, "initial_check": output, "repair_check": output2, "reason": f"post_repair_exit_{status2}"}
    finally:
        if not path.exists() and original.exists():
            original.rename(path)


def sha256(path):
    return subprocess.check_output(["sha256sum", str(path)], text=True).split()[0]


def download(url, path):
    if re.search(r"\.pdf\.enc(?:\?|$)", url, re.I):
        raise ValueError("encrypted .pdf.enc candidate rejected; Rechercher requires a real .pdf")
    subprocess.run([
        "curl", "-L", "--fail", "--retry", "5", "--retry-delay", "2",
        "--connect-timeout", "30", "--max-time", str(DOWNLOAD_TIMEOUT),
        "-o", str(path), url,
    ], check=True)


def quality_score(path):
    size = path.stat().st_size
    pages = 0
    try:
        p = subprocess.run(["pdfinfo", str(path)], text=True, capture_output=True, check=False)
        m = re.search(r"^Pages:\s*(\d+)", p.stdout, re.M)
        if m:
            pages = int(m.group(1))
    except Exception:
        pass
    text_chars = 0
    try:
        p = subprocess.run(["pdftotext", "-f", "1", "-l", str(max(1, pages or 1)), str(path), "-"], text=True, capture_output=True, check=False)
        if p.returncode == 0:
            text_chars = len(re.sub(r"\s+", "", p.stdout))
    except Exception:
        pass
    chars_per_page = text_chars / max(1, pages)
    text_score = min(100.0, chars_per_page / 8.0) if text_chars else 0.0
    dpi = []
    try:
        p = subprocess.run(["pdfimages", "-list", str(path)], text=True, capture_output=True, check=False)
        for line in p.stdout.splitlines():
            s = line.strip()
            if not s or not re.match(r"^\d+\s+\d+\s+", s):
                continue
            cols = s.split()
            if len(cols) >= 14:
                for idx in (12, 13):
                    try:
                        v = float(cols[idx])
                        if 10 <= v <= 2400:
                            dpi.append(v)
                    except ValueError:
                        pass
    except Exception:
        pass
    if dpi:
        median = sorted(dpi)[len(dpi) // 2]
        if median < 75:
            dpi_score = 20.0 * median / 75.0
        elif median < 150:
            dpi_score = 20.0 + 40.0 * (median - 75) / 75.0
        elif median < 300:
            dpi_score = 60.0 + 35.0 * (median - 150) / 150.0
        else:
            dpi_score = 95.0 + 5.0 * min(1.0, (median - 300) / 300.0)
    else:
        median = None
        dpi_score = 35.0 if text_chars else 15.0
    size_mb = size / (1024 * 1024)
    size_score = min(100.0, 35.0 + 12.0 * math.log1p(max(0.0, size_mb)))
    page_score = min(100.0, pages / 800.0 * 100.0) if pages else 0.0
    score = 0.50 * dpi_score + 0.20 * text_score + 0.15 * page_score + 0.15 * size_score
    return {
        "score": round(score, 3), "pages": pages, "bytes": size,
        "size_mb": round(size_mb, 3), "text_chars": text_chars,
        "chars_per_page": round(chars_per_page, 2),
        "median_image_dpi": round(median, 2) if median is not None else None,
        "quality_basis": "dpi>text-layer>page-completeness>weak-size-signal",
    }


def source_candidates(book):
    candidates = []
    for source in book.get("sources", []):
        if isinstance(source, str):
            candidates.append({"url": source, "label": "catalogued-source", "discover_pdfs": True})
        elif isinstance(source, dict) and source.get("url"):
            candidates.append(dict(source))
    for key in ("source_url", "url"):
        if book.get(key):
            candidates.append({"url": book[key], "label": key, "discover_pdfs": True})
    unique, seen = [], set()
    for candidate in candidates:
        try:
            u = normalize_url(candidate["url"])
        except Exception:
            continue
        if u not in seen:
            seen.add(u)
            candidate["url"] = u
            unique.append(candidate)
    return unique


def candidate_urls(source):
    if source.get("pdf_url") and not re.search(r"\.pdf\.enc(?:\?|$)", source["pdf_url"], re.I):
        return [normalize_url(source["pdf_url"])]
    page = source["url"]
    if re.search(r"\.pdf(?:\?|$)", page, re.I) and not re.search(r"\.pdf\.enc(?:\?|$)", page, re.I):
        return [normalize_url(page)]
    try:
        discovered = pdf_links(fetch(page), page)
    except Exception:
        discovered = []
    return discovered if discovered else [normalize_url(page)]


def acquire_volume(book, volume, expected, work):
    attempts = []
    sources = source_candidates(book)
    if not sources:
        return None, {"volume": volume, "status": "no_catalogued_source"}
    best = None
    try:
        for source_index, source in enumerate(sources, 1):
            try:
                urls = candidate_urls(source)
            except Exception as exc:
                attempts.append({"source": source.get("url"), "status": "source_error", "error": str(exc)})
                continue
            if source.get("volume") is not None and int(source["volume"]) != volume:
                continue
            if source.get("volume_url_map"):
                mapped = source["volume_url_map"].get(str(volume)) or source["volume_url_map"].get(volume)
                urls = [mapped] if mapped else []
            elif source.get("discover_pdfs"):
                if len(urls) < expected:
                    attempts.append({"source": source.get("url"), "status": "incomplete_source", "found_pdfs": len(urls), "expected": expected})
                    continue
                urls = [urls[volume - 1]]
            else:
                urls = urls[:MAX_SOURCE_ATTEMPTS]
            for url_index, url in enumerate(urls[:MAX_SOURCE_ATTEMPTS], 1):
                candidate = work / f"{volume:03d}.candidate-{source_index}-{url_index}.pdf"
                try:
                    if re.search(r"\.pdf\.enc(?:\?|$)", url, re.I):
                        attempts.append({"source": url, "status": "encrypted_rejected"})
                        continue
                    print(f"Quality candidate {book_key(book)} volume {volume}/{expected} source {source_index}/{len(sources)}: {url}", flush=True)
                    download(url, candidate)
                    if candidate.read_bytes()[:4] != b"%PDF":
                        attempts.append({"source": url, "status": "invalid_signature"})
                        continue
                    validation = validate_and_repair(candidate)
                    if validation["status"] not in ("valid", "repaired"):
                        attempts.append({"source": url, "status": "invalid_pdf", "reason": validation.get("reason")})
                        continue
                    quality = inspect_pdf(candidate)
                    if quality.get("status") != "pass":
                        attempts.append({"source": url, "status": "quality_rejected", "reason": quality.get("reason"), "quality": quality})
                        print(f"REJECTED quality {book_key(book)} volume {volume}: {url} reason={quality.get('reason')}", flush=True)
                        continue
                    q = quality_score(candidate)
                    rec = {"source": url, "source_label": source.get("label"), "source_index": source_index, "url_index": url_index, "validation": validation, "quality": q, "quality_gate": quality}
                    attempts.append({"source": url, "status": "valid_candidate", "quality": q})
                    rank = (q["score"], q.get("median_image_dpi") or 0, q["pages"], q["bytes"])
                    best_rank = (best["quality"]["score"], best["quality"].get("median_image_dpi") or 0, best["quality"]["pages"], best["quality"]["bytes"]) if best else None
                    if best is None or rank > best_rank:
                        if best is not None:
                            Path(best["path"]).unlink(missing_ok=True)
                        best = {**rec, "path": str(candidate)}
                    else:
                        candidate.unlink(missing_ok=True)
                except Exception as exc:
                    attempts.append({"source": url, "status": "download_or_quality_error", "error": str(exc)})
                finally:
                    if candidate.exists() and (best is None or best.get("path") != str(candidate)):
                        candidate.unlink(missing_ok=True)
        if best is None:
            return None, {"volume": volume, "status": "failed", "attempts": attempts}
        final = work / f"{volume:03d}.pdf"
        Path(best["path"]).replace(final)
        return final, {
            "volume": volume, "status": "selected-best-quality", "url": best["source"],
            "source_label": best.get("source_label"), "source_index": best.get("source_index"),
            "bytes": final.stat().st_size, "sha256": sha256(final),
            "validation": best["validation"], "quality": best["quality"],
            "quality_gate": best["quality_gate"],
            "candidate_count": sum(1 for a in attempts if a.get("status") == "valid_candidate"),
            "attempts": attempts,
        }
    finally:
        for p in work.glob(f"{volume:03d}.candidate-*.pdf"):
            p.unlink(missing_ok=True)


def resolve_expected_volumes(book):
    value = book.get("expected_volumes")
    if value is None:
        for field in ("volumes", "volume_count", "num_volumes"):
            value = book.get(field)
            if value is not None:
                break
    try:
        value = int(value)
    except (TypeError, ValueError):
        return None
    return value if value > 0 else None


def acquire(book):
    expected = resolve_expected_volumes(book)
    if expected is None:
        return {"id": book_key(book), "status": "blocked-missing-expected-volumes", "rights_state": rights_state(book), "error": "acquisition metadata missing: expected_volumes"}
    safe = re.sub(r"[^a-z0-9._-]+", "-", book_key(book).lower()).strip("-")
    work = ART / safe
    work.mkdir(parents=True, exist_ok=True)
    vols, failed = [], []
    for volume in range(1, expected + 1):
        final = work / f"{volume:03d}.pdf"
        if final.exists() and not REEVALUATE_EXISTING:
            validation = validate_and_repair(final)
            quality = inspect_pdf(final) if validation["status"] in ("valid", "repaired") else {"status": "fail", "reason": "qpdf-invalid"}
            if validation["status"] in ("valid", "repaired") and quality.get("status") == "pass":
                vols.append({"volume": volume, "status": "already-present", "bytes": final.stat().st_size, "sha256": sha256(final), "validation": validation, "quality_gate": quality})
                continue
            final.unlink(missing_ok=True)
        _, record = acquire_volume(book, volume, expected, work)
        if record.get("status") in ("failed", "no_catalogued_source"):
            failed.append(record)
        else:
            vols.append(record)
    if failed:
        (work / "retry.json").write_text(json.dumps({"id": book_key(book), "failed_volumes": failed}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return {"id": book_key(book), "status": "partial", "failed_volumes": failed, "rights_state": rights_state(book)}
    unified = ART / f"{safe}.pdf"
    pages = [str(work / f"{n:03d}.pdf") for n in range(1, expected + 1)]
    subprocess.run(["qpdf", "--empty", "--pages", *pages, "--", str(unified)], check=True)
    unified_validation = validate_and_repair(unified)
    if unified_validation["status"] not in ("valid", "repaired"):
        return {"id": book_key(book), "status": "unified-validation-failed", "rights_state": rights_state(book)}
    unified_quality = inspect_pdf(unified)
    if unified_quality.get("status") != "pass":
        unified.unlink(missing_ok=True)
        return {"id": book_key(book), "status": "unified-quality-failed", "quality_gate": unified_quality, "rights_state": rights_state(book)}
    state = rights_state(book)
    redistributable = redistribution_is_allowed(book)
    manifest = {
        "id": book_key(book), "title": book.get("title"), "author": book.get("author"),
        "edition": book.get("edition"), "expected_volumes": expected, "downloaded_volumes": len(vols),
        "volumes": vols, "unified_file": str(unified.relative_to(ROOT)), "unified_bytes": unified.stat().st_size,
        "unified_sha256": sha256(unified), "unified_validation": unified_validation, "unified_quality_gate": unified_quality,
        "acquisition": "acquired", "pdf": "real+validated", "storage": "permanent",
        "rights_review": state, "acquisition_basis_at_download": book.get("acquisition_status") or book.get("rights_status"),
        "public_browser": redistributable, "public_download": redistributable,
        "developer_private_access": True,
        "storage_visibility": "private-protected" if not redistributable else "publication-eligible",
        "browser_publication": "allowed" if redistributable else "blocked-protected-private",
    }
    (ART / f"{safe}.manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"ACQUIRED {book_key(book)}: retained real PDF; rights_review={state}; public_browser={redistributable}", flush=True)
    return {"id": book_key(book), "status": "acquired", "manifest": str((ART / f"{safe}.manifest.json").relative_to(ROOT)), "sha256": manifest["unified_sha256"], "rights_state": state}


def load_books():
    books = {}
    catalogs = sorted((ROOT / "books-batches").glob("**/catalog.json")) if (ROOT / "books-batches").exists() else []
    for catalog_path in catalogs:
        print(f"=== Loading catalog: {catalog_path.relative_to(ROOT)} ===", flush=True)
        try:
            data = json.loads(catalog_path.read_text(encoding="utf-8"))
        except Exception as exc:
            print(f"[CATALOG ERROR] {catalog_path}: {exc}", flush=True)
            continue
        for book in data.get("books", []):
            if not isinstance(book, dict):
                continue
            key = book_key(book)
            if key not in books:
                books[key] = dict(book)
                continue
            merged = books[key]
            for field, value in book.items():
                if field not in merged or merged.get(field) in (None, "", [], {}):
                    merged[field] = value
            if isinstance(merged.get("sources"), list) and isinstance(book.get("sources"), list):
                seen = {json.dumps(v, ensure_ascii=False, sort_keys=True) for v in merged["sources"]}
                for value in book["sources"]:
                    marker = json.dumps(value, ensure_ascii=False, sort_keys=True)
                    if marker not in seen:
                        merged["sources"].append(value)
                        seen.add(marker)
    return list(books.values())


def main():
    books = load_books()
    print(f"=== Rechercher independent real-PDF engine: {len(books)} unique books, {MAX_BOOK_WORKERS} workers ===", flush=True)
    summary = []
    with ThreadPoolExecutor(max_workers=MAX_BOOK_WORKERS, thread_name_prefix="rechercher-pdf") as pool:
        futures = {pool.submit(acquire, book): book for book in books}
        for future in as_completed(futures):
            book = futures[future]
            try:
                summary.append(future.result())
            except Exception as exc:
                print(f"[RETRY] {book_key(book)}: unexpected error: {exc}", flush=True)
                summary.append({"id": book_key(book), "status": "unexpected-error", "error": str(exc)})
    (ART / "acquisition-run-summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    blocked = [x for x in summary if x.get("status") not in ("acquired",)]
    print(f"ENGINE_SUMMARY acquired={len(summary)-len(blocked)} blocked_or_failed={len(blocked)} total={len(summary)}", flush=True)
    if blocked:
        # A green CI run must never hide a complete acquisition failure.
        raise SystemExit(1)


if __name__ == "__main__":
    main()
