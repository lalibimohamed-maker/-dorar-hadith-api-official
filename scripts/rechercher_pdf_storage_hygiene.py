#!/usr/bin/env python3
"""Remove forbidden encrypted/non-PDF files from a Rechercher storage tree.

Only storage artifacts are touched. Metadata, manifests, catalogs and source
records are deliberately left alone. A final book artifact must be a non-empty
file beginning with the real PDF signature %PDF-.
"""
from __future__ import annotations

import argparse
from pathlib import Path

FORBIDDEN_SUFFIXES = ('.pdf.enc', '.enc', '.encrypted')


def is_real_pdf(path: Path) -> bool:
    try:
        return path.is_file() and path.stat().st_size > 0 and path.open('rb').read(5) == b'%PDF-'
    except OSError:
        return False


def clean(root: Path, storage_glob: str) -> list[str]:
    removed: list[str] = []
    for path in root.glob(storage_glob):
        if not path.is_file():
            continue
        if path.name.endswith(FORBIDDEN_SUFFIXES) or path.suffix.lower() == '.pdf' and not is_real_pdf(path):
            path.unlink()
            removed.append(str(path.relative_to(root)))
    return removed


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', required=True)
    ap.add_argument('--glob', action='append', required=True)
    args = ap.parse_args()
    root = Path(args.root).resolve()
    removed: list[str] = []
    for pattern in args.glob:
        removed.extend(clean(root, pattern))
    print(f'[PDF HYGIENE] removed={len(removed)}')
    for item in removed:
        print(f'[PDF HYGIENE] removed {item}')


if __name__ == '__main__':
    main()
