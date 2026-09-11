#!/usr/bin/env python3
"""Master-catalog gate for the continuous Rechercher acquisition engine."""
from __future__ import annotations
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / "scripts/rechercher_materialize_master_catalog.py"
GOVERNED_BUILDER = ROOT / ".governance-source/scripts/rechercher_materialize_master_catalog.py"
CORE = ROOT / "scripts/rechercher_sequential_acquisition_engine_core.py"


def main() -> int:
    if not BUILDER.is_file():
        if not GOVERNED_BUILDER.is_file():
            raise SystemExit(f"missing master catalog materializer: {GOVERNED_BUILDER}")
        shutil.copy2(GOVERNED_BUILDER, BUILDER)
    subprocess.run([sys.executable, str(BUILDER)], cwd=ROOT, check=True)
    return subprocess.run([sys.executable, str(CORE), *sys.argv[1:]], cwd=ROOT, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
