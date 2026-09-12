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

    statuses = {str(item.get("status")) for item in summary if isinstance(item, dict)}
    if statuses and statuses.issubset(RETRYABLE_STATUSES):
        retryable = sum(
            1
            for item in summary
            if isinstance(item, dict) and item.get("status") in RETRYABLE_STATUSES
        )
        print(
            f"RETRYABLE_ACQUISITION_GAPS={retryable} "
            "(kept pending for the next scheduled pass)",
            flush=True,
        )
        return 0

    return engine_result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
