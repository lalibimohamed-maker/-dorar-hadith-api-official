#!/usr/bin/env python3
"""Deterministically repair known workflow-policy drift.

Safety boundary: this script never force-pushes and never edits corpus/content data.
Governed acquisition workflows are reduced to callers of the central reusable
workflow; the acquisition implementation lives only in the central workflow/source.
"""
from __future__ import annotations

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"
BANNED_SINGLE_VOLUME = WORKFLOWS / "rechercher-waqfeya-pdf-download-01.yml"
ACQUISITION_NAMES = {
    "rechercher-multivolume-acquisition.yml",
    "rechercher-governed-multivolume-book-acquisition.yml",
}
CENTRAL_REUSABLE = "lalibimohamed-maker/-dorar-hadith-api-official/.github/workflows/rechercher-governed-acquisition.yml@main"
SKIP_MARKERS = ("[skip ci]", "[ci skip]", "[no ci]", "[skip actions]", "[actions skip]")

CALLER_TEMPLATE = """name: Rechercher — governed multi-volume acquisition

on:
  push:
    branches:
      - 'rechercher/**'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  acquire:
    uses: {central}
    permissions:
      contents: write
""".format(central=CENTRAL_REUSABLE)


def repair_file(path: pathlib.Path) -> bool:
    original = path.read_text(encoding="utf-8")
    if path.name in ACQUISITION_NAMES:
        if original != CALLER_TEMPLATE:
            path.write_text(CALLER_TEMPLATE, encoding="utf-8")
            return True
        return False

    updated = original
    for marker in SKIP_MARKERS:
        updated = updated.replace(marker, "")
    if updated != original:
        path.write_text(updated, encoding="utf-8")
        return True
    return False


def main() -> int:
    if not WORKFLOWS.exists():
        print("No workflow directory; nothing to repair.")
        return 0

    changed: list[str] = []
    if BANNED_SINGLE_VOLUME.exists():
        BANNED_SINGLE_VOLUME.unlink()
        changed.append(str(BANNED_SINGLE_VOLUME.relative_to(ROOT)))

    for path in sorted(WORKFLOWS.glob("rechercher*.yml")) + sorted(WORKFLOWS.glob("rechercher*.yaml")):
        if path.exists() and repair_file(path):
            changed.append(str(path.relative_to(ROOT)))

    if changed:
        print("POLICY_REPAIRED")
        for item in changed:
            print(item)
    else:
        print("POLICY_COMPLIANT")
    return 0


if __name__ == "__main__":
    sys.exit(main())
