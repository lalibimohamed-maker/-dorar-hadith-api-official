#!/usr/bin/env python3
"""Deterministically repair only the repository's known workflow-policy drift.

Safety boundary: this script never force-pushes and never edits content/data files.
It is intentionally conservative: ambiguous workflow differences are reported,
not rewritten.
"""
from __future__ import annotations

import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"
BANNED_SINGLE_VOLUME = WORKFLOWS / "rechercher-waqfeya-pdf-download-01.yml"
ACQUISITION_NAMES = {
    "rechercher-multivolume-acquisition.yml",
    "rechercher-governed-multivolume-book-acquisition.yml",
}
SKIP_MARKERS = ("[skip ci]", "[ci skip]", "[no ci]", "[skip actions]", "[actions skip]")


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def repair_file(path: pathlib.Path) -> bool:
    original = path.read_text(encoding="utf-8")
    updated = original

    # Remove CI-suppressing markers only from workflow source. This does not
    # touch ordinary documentation or content.
    for marker in SKIP_MARKERS:
        updated = updated.replace(marker, "")

    # Acquisition producers must be push/manual producers, not PR producers.
    # We only rewrite the exact governed acquisition workflow names.
    if path.name in ACQUISITION_NAMES:
        updated = re.sub(
            r"(?ms)^\s*pull_request:\n(?:^[ \t]+.*\n)*?(?=^\s*workflow_dispatch:|^\s*permissions:|^\s*jobs:)",
            "",
            updated,
        )
        if "\npush:\n" not in updated and "\npush:" not in updated:
            updated = updated.replace("on:\n", "on:\n  push:\n    branches:\n      - 'rechercher/**'\n", 1)
        elif "branches:" not in updated.split("push:", 1)[1].split("permissions:", 1)[0]:
            updated = updated.replace("  push:\n", "  push:\n    branches:\n      - 'rechercher/**'\n", 1)

    if updated != original:
        path.write_text(updated, encoding="utf-8")
        return True
    return False


def main() -> int:
    if not WORKFLOWS.exists():
        print("No workflow directory; nothing to repair.")
        return 0

    changed: list[str] = []

    # Known obsolete producer: remove it wherever this policy is enforced.
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
