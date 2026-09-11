#!/usr/bin/env python3
"""Master-catalog gate for the continuous Rechercher acquisition engine."""
from __future__ import annotations
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / "scripts/rechercher_materialize_master_catalog.py"
CORE = ROOT / "scripts/rechercher_sequential_acquisition_engine_core.py"


def main() -> int:
    subprocess.run([sys.executable, str(BUILDER)], cwd=ROOT, check=True)
    return subprocess.run([sys.executable, str(CORE), *sys.argv[1:]], cwd=ROOT, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
