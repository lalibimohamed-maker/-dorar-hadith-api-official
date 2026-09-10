#!/usr/bin/env python3
"""Lightweight PDF scan-quality scoring for Rechercher.

This evaluates rendered page images without changing the source PDF.  It is a
quality gate, not an OCR/text rewriting step.  The workflow installs poppler's
pdftoppm; qpdf validation remains the authoritative structural PDF check.
"""
from __future__ import annotations

import json
import math
import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any

MIN_ACCEPT_SCORE = 72.0
RENDER_DPI = 110
MAX_SAMPLE_PAGES = 4


def _run(cmd: list[str], timeout: int = 45) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, text=True, capture_output=True, timeout=timeout, check=False)


def _pdfinfo(path: Path) -> tuple[int, int, int]:
    r = _run(["pdfinfo", str(path)])
    if r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout or "pdfinfo failed").strip())
    pages = 0
    width = height = 0
    for line in r.stdout.splitlines():
        if line.startswith("Pages:"):
            pages = int(line.split(":", 1)[1].strip())
        elif line.startswith("Page size:"):
            m = re.search(r"([0-9.]+)\s+x\s+([0-9.]+)", line)
            if m:
                width = int(round(float(m.group(1))))
                height = int(round(float(m.group(2))))
    if pages <= 0:
        raise RuntimeError("pdfinfo returned no page count")
    return pages, width, height


def _sample_pages(page_count: int) -> list[int]:
    wanted = [1, 2, max(1, (page_count + 1) // 2), page_count]
    return list(dict.fromkeys(p for p in wanted if 1 <= p <= page_count))[:MAX_SAMPLE_PAGES]


def _read_pgm(path: Path) -> tuple[int, int, bytes]:
    raw = path.read_bytes()
    if not raw.startswith(b"P5"):
        raise RuntimeError("pdftoppm did not emit a binary PGM")
    i = 2
    tokens: list[bytes] = []
    while len(tokens) < 3:
        while i < len(raw) and raw[i] in b" \t\r\n":
            i += 1
        if i < len(raw) and raw[i] == ord("#"):
            while i < len(raw) and raw[i] not in b"\r\n":
                i += 1
            continue
        j = i
        while j < len(raw) and raw[j] not in b" \t\r\n":
            j += 1
        tokens.append(raw[i:j])
        i = j
    width, height, maxval = map(int, tokens)
    if maxval != 255:
        raise RuntimeError(f"unexpected PGM max value: {maxval}")
    while i < len(raw) and raw[i] in b" \t\r\n":
        i += 1
    expected = width * height
    pixels = raw[i:i + expected]
    if len(pixels) != expected:
        raise RuntimeError("truncated PGM pixel data")
    return width, height, pixels


def _page_metrics(pixels: bytes) -> dict[str, float]:
    if not pixels:
        return {"mean": 0.0, "std": 0.0, "background_ratio": 0.0, "ink_ratio": 0.0, "dynamic_range": 0.0}
    step = max(1, len(pixels) // 400_000)
    sample = pixels[::step]
    n = len(sample)
    mean = sum(sample) / n
    variance = sum((x - mean) ** 2 for x in sample) / n
    std = math.sqrt(variance)
    background_ratio = sum(x >= 245 for x in sample) / n
    ink_ratio = sum(x <= 80 for x in sample) / n
    ordered = sorted(sample)
    lo = ordered[max(0, int(n * 0.01) - 1)]
    hi = ordered[min(n - 1, int(n * 0.99))]
    return {
        "mean": round(mean, 2),
        "std": round(std, 2),
        "background_ratio": round(background_ratio, 4),
        "ink_ratio": round(ink_ratio, 4),
        "dynamic_range": float(hi - lo),
    }


def _score_page(m: dict[str, float]) -> float:
    score = 0.0
    # Strong text/background separation.
    score += min(25.0, max(0.0, (m["std"] - 16.0) * 0.78))
    score += min(20.0, max(0.0, (m["background_ratio"] - 0.30) * 35.0))
    # Enough dark ink to ensure a real page, without rewarding solid-black pages.
    ink = m["ink_ratio"]
    if 0.01 <= ink <= 0.18:
        score += 12.0
    elif 0.005 <= ink <= 0.28:
        score += 7.0
    elif ink > 0:
        score += 2.0
    score += min(18.0, max(0.0, (m["dynamic_range"] - 100.0) * 0.10))
    return min(75.0, score)


def _resolution_score(width: int, height: int) -> float:
    short_edge = min(width, height)
    if short_edge >= 1600:
        return 25.0
    if short_edge >= 1300:
        return 22.0
    if short_edge >= 1100:
        return 18.0
    if short_edge >= 900:
        return 14.0
    if short_edge >= 750:
        return 9.0
    if short_edge >= 600:
        return 5.0
    return 0.0


def score_pdf(path: str | os.PathLike[str]) -> dict[str, Any]:
    pdf = Path(path)
    pages, page_width_pt, page_height_pt = _pdfinfo(pdf)
    samples = _sample_pages(pages)
    page_results: list[dict[str, Any]] = []
    with tempfile.TemporaryDirectory(prefix="rechercher-quality-") as td:
        tmp = Path(td)
        for page in samples:
            prefix = tmp / f"page-{page}"
            r = _run(["pdftoppm", "-f", str(page), "-singlefile", "-r", str(RENDER_DPI), "-gray", str(pdf), str(prefix)], timeout=60)
            if r.returncode != 0:
                raise RuntimeError((r.stderr or r.stdout or f"pdftoppm failed on page {page}").strip())
            pgm = prefix.with_suffix(".pgm")
            width, height, pixels = _read_pgm(pgm)
            metrics = _page_metrics(pixels)
            metrics["page_score"] = round(_score_page(metrics), 2)
            metrics["width_px"] = width
            metrics["height_px"] = height
            page_results.append({"page": page, **metrics})
    avg_page = sum(float(x["page_score"]) for x in page_results) / max(1, len(page_results))
    res_score = _resolution_score(page_results[0]["width_px"], page_results[0]["height_px"]) if page_results else 0.0
    total = round(avg_page + res_score, 2)
    if total >= 88:
        grade = "excellent"
    elif total >= 78:
        grade = "good"
    elif total >= MIN_ACCEPT_SCORE:
        grade = "acceptable"
    else:
        grade = "poor"
    return {
        "score": total,
        "grade": grade,
        "accepted": total >= MIN_ACCEPT_SCORE,
        "pages": pages,
        "render_dpi": RENDER_DPI,
        "samples": page_results,
        "page_size_pt": {"width": page_width_pt, "height": page_height_pt},
    }


def quality_gate(path: str | os.PathLike[str]) -> tuple[bool, str]:
    try:
        result = score_pdf(path)
    except Exception as exc:
        return False, json.dumps({"quality_gate": "error", "error": f"{type(exc).__name__}: {exc}"}, ensure_ascii=False)
    return bool(result["accepted"]), json.dumps({"quality_gate": result}, ensure_ascii=False, separators=(",", ":"))
