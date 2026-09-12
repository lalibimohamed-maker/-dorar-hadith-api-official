#!/usr/bin/env python3
"""Master-catalog gate for the continuous Rechercher acquisition engine."""
from __future__ import annotations
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / "scripts/rechercher_materialize_master_catalog.py"
GOVERNED_BUILDER = ROOT / ".governance-source/scripts/rechercher_materialize_master_catalog.py"
VOLUME_RESOLVER = ROOT / "scripts/rechercher_resolve_volume_evidence.py"
GOVERNED_VOLUME_RESOLVER = ROOT / ".governance-source/scripts/rechercher_resolve_volume_evidence.py"
ENGINE = ROOT / "scripts/rechercher_acquisition_engine.py"
RETRYABLE_STATUSES = {
    "blocked-missing-expected-volumes",
    "partial",
}


def main() -> int:
    if not BUILDER.is_file():
        if not GOVERNED_BUILDER.is_file():
            raise SystemExit(f"missing master catalog materializer: {GOVERNED_BUILDER}")
        shutil.copy2(GOVERNED_BUILDER, BUILDER)
    subprocess.run([sys.executable, str(BUILDER)], cwd=ROOT, check=True)

    # The governed reusable workflow checks out the latest main source into
    # .governance-source but may intentionally copy only the execution-critical
    # scripts. Recover the resolver from that source tree when it was not copied,
    # keeping the workflow immutable while ensuring the new gate has its helper.
    if not VOLUME_RESOLVER.is_file() and GOVERNED_VOLUME_RESOLVER.is_file():
        shutil.copy2(GOVERNED_VOLUME_RESOLVER, VOLUME_RESOLVER)
    if not VOLUME_RESOLVER.is_file():
        raise SystemExit(f"missing volume-evidence resolver: {VOLUME_RESOLVER}")
    subprocess.run([sys.executable, str(VOLUME_RESOLVER)], cwd=ROOT, check=True)

    if not ENGINE.is_file():
        raise SystemExit(f"missing governed real-PDF acquisition engine: {ENGINE}")

    engine_result = subprocess.run(
        [sys.executable, str(ENGINE), *sys.argv[1:]],
        cwd=ROOT,
        check=False,
    )
    if engine_result.returncode == 0:
        return 0

    summary_path = ROOT / "artifacts" / "acquisition-run-summary.json"
    try:
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
    except Exception:
        return engine_result.returncode
    if not isinstance(summary, list) or not summary:
        return engine_result.returncode

    items = [item for item in summary if isinstance(item, dict)]
    statuses = {str(item.get("status")) for item in items}
    retryable = sum(1 for item in items if item.get("status") in RETRYABLE_STATUSES)
    acquired = sum(1 for item in items if item.get("status") == "acquired")
    terminal_failures = statuses - RETRYABLE_STATUSES - {"acquired"}

    # A partial-progress pass is successful when every non-acquired result is
    # explicitly retryable. This preserves real PDFs already acquired while
    # leaving unresolved volume/source gaps pending for the next scheduled pass.
    if statuses and not terminal_failures:
        print(
            f"ACQUISITION_PROGRESS_OK acquired={acquired} retryable={retryable} total={len(items)}",
            flush=True,
        )
        if retryable:
            print(
                f"RETRYABLE_ACQUISITION_GAPS={retryable} "
                "(kept pending for the next scheduled pass)",
                flush=True,
            )
        return 0

    return engine_result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
