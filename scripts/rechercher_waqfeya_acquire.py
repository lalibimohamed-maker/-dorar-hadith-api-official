#!/usr/bin/env python3
"""Live-progress entry point for the central Rechercher PDF engine.

The central acquisition path now executes one ordered queue:
Prophet era -> Quran -> Seerah -> Companions -> Followers -> 1-400H ->
401-800H -> 801-1200H -> 1201H -> Modern era -> Future books.

The existing downloader remains the worker for each stage, so source failover,
PDF validation, hashing, manifests, retry records and LFS handling are reused.
Set RECHERCHER_SEQUENTIAL=0 only for controlled debugging of the legacy worker.
"""
from __future__ import annotations

import os
import pathlib
import re
import subprocess
import sys
import threading
import time
from urllib.request import Request, urlopen
import runpy

HERE = pathlib.Path(__file__).resolve().parent
ORIGINAL = HERE / "rechercher_waqfeya_acquire_original.py"
SEQUENTIAL = HERE / "rechercher_sequential_acquisition.py"
MIB = 1024 * 1024
REAL_RUN = subprocess.run


def _download_stream(url: str, path: str) -> None:
    if re.search(r"\.pdf\.enc(?:[?#]|$)", url, re.I):
        raise ValueError("encrypted .pdf.enc is forbidden; Rechercher requires a real .pdf")
    last_error = None
    for attempt in range(1, 6):
        stop = threading.Event()
        started = time.monotonic()
        label = pathlib.Path(path).name

        def beat() -> None:
            while not stop.wait(15):
                print(
                    f"[PDF WAIT] engine=waqfeya file={label} elapsed={int(time.monotonic() - started)}s attempt={attempt}/5",
                    flush=True,
                )

        thread = threading.Thread(target=beat, name="rechercher-pdf-heartbeat", daemon=True)
        thread.start()
        try:
            request = Request(url, headers={"User-Agent": "DinAllah-Encyclopedia/1.3"})
            with urlopen(request, timeout=120) as response:
                content_type = (response.headers.get("Content-Type") or "").lower()
                total_header = response.headers.get("Content-Length")
                try:
                    total = int(total_header) if total_header else 0
                except ValueError:
                    total = 0
                total_text = f"{total / MIB:.1f} MB" if total else "unknown"
                print(
                    f"[PDF START] engine=waqfeya file={label} expected={total_text} url={response.geturl()}",
                    flush=True,
                )
                with open(path, "wb") as out:
                    downloaded = 0
                    next_mark = MIB
                    while True:
                        chunk = response.read(256 * 1024)
                        if not chunk:
                            break
                        out.write(chunk)
                        downloaded += len(chunk)
                        while downloaded >= next_mark:
                            print(
                                f"[PDF PROGRESS] engine=waqfeya file={label} "
                                f"{next_mark / MIB:.0f} MB / {total_text}",
                                flush=True,
                            )
                            next_mark += MIB
                if downloaded < 5 or content_type and "pdf" not in content_type and not path.lower().endswith(".pdf"):
                    raise ValueError(f"downloaded content does not look like a PDF: {downloaded} bytes, {content_type}")
                print(f"[PDF DONE] engine=waqfeya file={label} PDF | {downloaded / MIB:.1f} MB", flush=True)
                return
        except Exception as exc:
            last_error = exc
            print(
                f"[PDF RETRY] engine=waqfeya file={label} attempt={attempt}/5 "
                f"{type(exc).__name__}: {exc}",
                flush=True,
            )
            if attempt == 5:
                raise
        finally:
            stop.set()

    raise last_error or RuntimeError("PDF download failed")


def _intercepted_run(cmd, *args, **kwargs):
    if isinstance(cmd, (list, tuple)) and cmd and cmd[0] == "curl" and "-o" in cmd:
        out_index = cmd.index("-o") + 1
        url = str(cmd[-1])
        path = str(cmd[out_index])
        _download_stream(url, path)
        return subprocess.CompletedProcess(cmd, 0)
    return REAL_RUN(cmd, *args, **kwargs)


subprocess.run = _intercepted_run

if __name__ == "__main__":
    sequential = os.environ.get("RECHERCHER_SEQUENTIAL", "1") != "0"
    if sequential:
        print("[RECHERCHER CENTRAL] ordered whole-encyclopedia queue enabled", flush=True)
        sys.argv = [str(SEQUENTIAL)] + sys.argv[1:]
        runpy.run_path(str(SEQUENTIAL), run_name="__main__")
    else:
        print("[RECHERCHER LEGACY DEBUG] sequential queue disabled explicitly", flush=True)
        print("[RECHERCHER LIVE] persistent PDF acquisition progress instrumentation enabled", flush=True)
        sys.argv = [str(ORIGINAL)] + sys.argv[1:]
        runpy.run_path(str(ORIGINAL), run_name="__main__")
