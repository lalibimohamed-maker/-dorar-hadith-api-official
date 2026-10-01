#!/usr/bin/env python3
"""Resolve the unified Release-backed PDF storage target for Rechercher."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path


EXPECTED_REPOSITORY = "lalibimohamed-maker/dinullah-matrix-6384-storage-01"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".")
    ap.add_argument("--config", default="config/rechercher-permanent-storage-pool.json")
    ap.add_argument("--output", default="artifacts/governance/storage-pool-route.json")
    ap.add_argument("--token-env", default="RECHERCHER_MATRIX_STORAGE_TOKEN")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    cfg = json.loads((root / args.config).read_text(encoding="utf-8"))

    if cfg.get("schema") != "din-allah-encyclopedia/permanent-storage-pool/v2":
        raise SystemExit("ERROR: unsupported unified Release storage schema")

    if cfg.get("storage_model") != "github-releases-only":
        raise SystemExit("ERROR: PDF storage must use GitHub Releases only")

    repo = cfg.get("repository")
    if repo != EXPECTED_REPOSITORY:
        raise SystemExit(f"ERROR: unexpected unified storage repository: {repo!r}")

    token = os.environ.get(args.token_env, "")
    if not token:
        raise SystemExit(f"ERROR: {args.token_env} is required for Release persistence")

    out = {
        "schema": "din-allah-encyclopedia/permanent-storage-pool-route/v2",
        "storage_model": "github-releases-only",
        "repository": repo,
        "release_target": "main",
        "reason": "unified-matrix-release-storage",
        "rights_unclear": "protected-private-only",
        "policy": "append-only; real .pdf Release assets only; SHA-256 identity; no Git/LFS PDF persistence",
        "lfs_pdf_persistence": False,
    }

    out_path = root / args.output
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(out, ensure_ascii=False))
    print(f"RECHERCHER_STORAGE_MODEL={out['storage_model']}")
    print(f"RECHERCHER_STORAGE_REPO={out['repository']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
