#!/usr/bin/env python3
"""Live-progress wrapper for the deep-worldwide PDF gap retry engine.

The original acquisition logic is preserved byte-for-byte in
rechercher_no_match_retry_original.py. This wrapper only adds observability:
engine start/result, source numbering, 15s wait heartbeats, and 1 MiB PDF
progress milestones through the final PDF size (for example 1 MB ... 18.7 MB).
"""
from __future__ import annotations

import importlib.util
import io
import pathlib
import re
import threading
import time
from urllib.request import Request, urlopen

HERE = pathlib.Path(__file__).resolve().parent
ORIGINAL = HERE / "rechercher_no_match_retry_original.py"

spec = importlib.util.spec_from_file_location("rechercher_no_match_retry_original", ORIGINAL)
if spec is None or spec.loader is None:
    raise RuntimeError(f"cannot load preserved engine: {ORIGINAL}")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

LIVE = {"book": "unknown", "engine": "unknown"}
MIB = 1024 * 1024
_PDF_PREFETCH = {}
_PDF_PREFETCH_LOCK = threading.Lock()


def _heartbeat(label: str, interval: int = 15):
    stop = threading.Event()
    started = time.monotonic()

    def beat() -> None:
        while not stop.wait(interval):
            print(f"[PDF WAIT] {label} elapsed={int(time.monotonic() - started)}s", flush=True)

    thread = threading.Thread(target=beat, name="rechercher-pdf-heartbeat", daemon=True)
    thread.start()
    return stop


def _pdf_like(url: str, content_type: str = "") -> bool:
    return "application/pdf" in content_type.lower() or bool(re.search(r"\.pdf(?:[?#]|$)", url, re.I))


def _pop_prefetch(url: str):
    with _PDF_PREFETCH_LOCK:
        return _PDF_PREFETCH.pop(url, None)


def _save_prefetch(url: str, payload):
    with _PDF_PREFETCH_LOCK:
        _PDF_PREFETCH.clear()
        _PDF_PREFETCH[url] = payload


def live_fetch(url: str):
    cached = _pop_prefetch(url)
    if cached is not None:
        print(f"[PDF REUSE] book={LIVE['book']} engine={LIVE['engine']} url={url} reused_prefetched_pdf=true", flush=True)
        return cached

    req = Request(
        url,
        headers={
            "User-Agent": getattr(mod, "UA", "DinAllah-Encyclopedia/Rechercher"),
            "Accept": "application/json,text/html,application/xhtml+xml,application/pdf,*/*",
        },
    )
    stop = _heartbeat(f"book={LIVE['book']} engine={LIVE['engine']}") if _pdf_like(url) else None
    try:
        with urlopen(req, timeout=getattr(mod, "TIMEOUT", 90)) as response:
            content_type = (response.headers.get("Content-Type") or "").lower()
            if not _pdf_like(url, content_type):
                return response.read(), content_type, response.geturl()

            final_url = response.geturl()
            total_header = response.headers.get("Content-Length")
            try:
                total = int(total_header) if total_header else 0
            except ValueError:
                total = 0
            total_text = f"{total / MIB:.1f} MB" if total else "unknown"
            print(
                f"[PDF START] book={LIVE['book']} engine={LIVE['engine']} "
                f"expected={total_text} url={final_url}",
                flush=True,
            )
            buf = io.BytesIO()
            downloaded = 0
            next_mark = MIB
            while True:
                chunk = response.read(1024 * 256)
                if not chunk:
                    break
                buf.write(chunk)
                downloaded += len(chunk)
                while downloaded >= next_mark:
                    print(
                        f"[PDF PROGRESS] book={LIVE['book']} engine={LIVE['engine']} "
                        f"{next_mark / MIB:.0f} MB / {total_text}",
                        flush=True,
                    )
                    next_mark += MIB
            payload = (buf.getvalue(), content_type, final_url)
            print(
                f"[PDF DONE] book={LIVE['book']} engine={LIVE['engine']} "
                f"PDF | {downloaded / MIB:.1f} MB",
                flush=True,
            )
            _save_prefetch(url, payload)
            if final_url != url:
                _save_prefetch(final_url, payload)
            return payload
    finally:
        if stop is not None:
            stop.set()


mod.fetch = live_fetch


def _wrap_engine(name: str):
    original = getattr(mod, name, None)
    if not callable(original):
        return

    def wrapped(*args, **kwargs):
        book = args[-1] if args else kwargs.get("book") or {}
        book_id = book.get("id", "unknown") if isinstance(book, dict) else "unknown"
        print(f"[ENGINE START] book={book_id} engine={name}", flush=True)
        try:
            result = original(*args, **kwargs)
            count = len(result) if hasattr(result, "__len__") else "?"
            print(f"[ENGINE RESULT] book={book_id} engine={name} candidates={count}", flush=True)
            return result
        except Exception as exc:
            print(f"[ENGINE ERROR] book={book_id} engine={name} {type(exc).__name__}: {exc}", flush=True)
            raise

    setattr(mod, name, wrapped)


for _name in (
    "saved_source_candidates",
    "archive_candidates",
    "open_library_candidates",
    "loc_candidates",
    "google_books_candidates",
    "crossref_candidates",
    "openiti_kitab_candidates",
    "arabic_index_candidates",
    "mediawiki_candidates",
):
    _wrap_engine(_name)

_original_candidates = mod.candidates


def live_candidates(rec):
    LIVE["book"] = rec.get("id", "unknown")
    pairs = _original_candidates(rec)
    print(
        f"[BOOK CANDIDATES] book={LIVE['book']} total_sources={len(pairs)}",
        flush=True,
    )
    for index, (engine, url) in enumerate(pairs, 1):
        LIVE["engine"] = engine
        print(
            f"[SOURCE] book={LIVE['book']} source={index}/{len(pairs)} engine={engine}",
            flush=True,
        )
        yield engine, url


mod.candidates = live_candidates

if __name__ == "__main__":
    print("[RECHERCHER LIVE] deep-worldwide acquisition progress instrumentation enabled", flush=True)
    mod.main()
