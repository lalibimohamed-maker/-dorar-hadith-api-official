#!/usr/bin/env python3
"""Non-destructive quality/completeness gate for acquired master PDFs."""
from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path


def run(cmd):
    p = subprocess.run(cmd, text=True, capture_output=True, check=False)
    return p.returncode, p.stdout, p.stderr


def inspect(pdf: Path):
    """Return the canonical technical-quality result for one PDF.

    This function is intentionally importable by the acquisition engine so a
    candidate is never promoted to acquired merely because qpdf accepts it.
    """
    if pdf.read_bytes()[:5] != b"%PDF-":
        return {"status": "fail", "reason": "not-a-pdf"}
    rc, out, err = run(["qpdf", "--check", str(pdf)])
    if rc != 0:
        return {"status": "fail", "reason": "qpdf-invalid", "detail": (out + err).strip()[-2000:]}
    rc, info, _ = run(["pdfinfo", str(pdf)])
    if rc != 0:
        return {"status": "fail", "reason": "pdfinfo-failed"}
    m = re.search(r"^Pages:\s*(\d+)", info, re.M)
    pages = int(m.group(1)) if m else 0
    if pages <= 0:
        return {"status": "fail", "reason": "no-pages"}
    rc, text, _ = run(["pdftotext", "-f", "1", "-l", str(pages), str(pdf), "-"])
    chars = len(re.sub(r"\s+", "", text)) if rc == 0 else 0
    rc_img, imgs, _ = run(["pdfimages", "-list", str(pdf)])
    dpis = []
    if rc_img == 0:
        for line in imgs.splitlines():
            cols = line.split()
            if len(cols) >= 14 and re.match(r"^\d+$", cols[0] or ""):
                for idx in (12, 13):
                    try:
                        v = float(cols[idx])
                        if 10 <= v <= 2400:
                            dpis.append(v)
                    except ValueError:
                        pass
    median = sorted(dpis)[len(dpis) // 2] if dpis else None
    blank_pages = 0
    if rc == 0:
        rc2, pages_text, _ = run(["pdftotext", "-layout", str(pdf), "-"])
        if rc2 == 0:
            chunks = re.split(r"\f", pages_text)
            blank_pages = sum(1 for c in chunks[:pages] if not c.strip())
    # Image-only scans are valid masters. Only flag excessive blank pages when
    # there is neither a usable text layer nor evidence of a readable scan.
    if blank_pages > max(2, int(pages * 0.02)) and chars == 0 and (median is None or median < 120):
        return {
            "status": "fail",
            "reason": "excessive-blank-pages",
            "pages": pages,
            "blank_pages": blank_pages,
            "median_image_dpi": median,
        }
    return {
        "status": "pass",
        "pages": pages,
        "bytes": pdf.stat().st_size,
        "text_chars": chars,
        "chars_per_page": round(chars / pages, 2),
        "median_image_dpi": median,
        "blank_pages": blank_pages,
        "checks": [
            "pdf-signature",
            "qpdf",
            "page-count",
            "text-layer",
            "image-resolution",
            "blank-page-sanity",
        ],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="artifacts")
    ap.add_argument("--report", default="artifacts/governance/pdf-quality-gate.json")
    a = ap.parse_args()
    root = Path(a.root)
    pdfs = sorted(root.glob("*.pdf"))
    results = []
    failed = []
    for pdf in pdfs:
        r = inspect(pdf)
        results.append({"file": pdf.name, **r})
        if r.get("status") != "pass":
            failed.append(pdf.name)
    report = {
        "schema": "rechercher-pdf-quality-gate/v1",
        "status": "PASS" if not failed else "FAIL",
        "pdf_count": len(pdfs),
        "failed": failed,
        "results": results,
        "policy": "technical quality and completeness gate; source PDF is never modified; rights/publication remain separate governance decisions",
    }
    out = Path(a.report)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "pdf_count": len(pdfs), "failed": len(failed)}))
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
