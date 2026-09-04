#!/usr/bin/env python3
"""Conservative branch-wide governance repair.

Repairs only known governance drift in workflow files. Never changes corpus,
book editions, source rights, or authoritative content, and never force-pushes.
"""
from __future__ import annotations

import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"
BANNED = WORKFLOWS / "rechercher-waqfeya-pdf-download-01.yml"
CALLER_NAMES = {
    "rechercher-multivolume-acquisition.yml",
    "rechercher-governed-multivolume-book-acquisition.yml",
}
CENTRAL = "lalibimohamed-maker/-dorar-hadith-api-official/.github/workflows/rechercher-governed-acquisition.yml@main"
MARKERS = ("[skip ci]", "[ci skip]", "[no ci]", "[skip actions]", "[actions skip]")
CALLER = f"""name: Rechercher — governed multi-volume acquisition

on:
  push:
    branches:
      - 'rechercher/**'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  acquire:
    uses: {CENTRAL}
    permissions:
      contents: write
"""

changed: list[str] = []
if BANNED.exists():
    BANNED.unlink()
    changed.append(str(BANNED.relative_to(ROOT)))

for path in sorted(WORKFLOWS.glob("*.yml")) + sorted(WORKFLOWS.glob("*.yaml")):
    original = path.read_text(encoding="utf-8")
    updated = CALLER if path.name in CALLER_NAMES else original
    for marker in MARKERS:
        updated = updated.replace(marker, "")
    if updated != original:
        path.write_text(updated, encoding="utf-8")
        changed.append(str(path.relative_to(ROOT)))

if changed:
    print("POLICY_REPAIRED")
    print("\n".join(changed))
else:
    print("POLICY_COMPLIANT")
