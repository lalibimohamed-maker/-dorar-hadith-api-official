#!/usr/bin/env python3
"""Resolve the permanent PDF storage target from the governed Storage Pool.

The resolver is intentionally fail-closed:
- only configured repositories can be selected;
- an active shard is used until its safe threshold is reached;
- a next shard is selected only when it is configured and available;
- no repository is ever invented or created by this script.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
from pathlib import Path


def run(cmd: list[str], cwd: Path | None = None) -> tuple[int, str, str]:
    p = subprocess.run(cmd, cwd=cwd, text=True, capture_output=True)
    return p.returncode, p.stdout.strip(), p.stderr.strip()


def repo_accessible(repo: str, token: str) -> bool:
    code, _, _ = run([
        "git", "ls-remote",
        f"https://x-access-token:{token}@github.com/{repo}.git",
    ])
    return code == 0


def local_lfs_gb(repo_dir: Path) -> float:
    obj = repo_dir / ".git" / "lfs" / "objects"
    if not obj.exists():
        return 0.0
    total = sum(p.stat().st_size for p in obj.rglob("*") if p.is_file())
    return total / (1024 ** 3)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".")
    ap.add_argument("--config", default="config/rechercher-permanent-storage-pool.json")
    ap.add_argument("--output", default="artifacts/governance/storage-pool-route.json")
    ap.add_argument("--token-env", default="RECHERCHER_SECONDARY_STORAGE_TOKEN")
    ap.add_argument("--existing-repo-dir", default="secondary")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    config_path = root / args.config
    cfg = json.loads(config_path.read_text(encoding="utf-8"))
    if cfg.get("schema") != "din-allah-encyclopedia/permanent-storage-pool/v1":n        raise SystemExit("ERROR: unsupported Storage Pool schema")

    token = os.environ.get(args.token_env, "")
    if not token:
        raise SystemExit(f"ERROR: {args.token_env} is required to resolve permanent storage")

    free = cfg.get("free_operation_policy", {})
    threshold = float(free.get("safe_storage_threshold_gb", 8.5))
    shards = [cfg.get("primary", {})] + list(cfg.get("future_shards", []))
    configured = [s for s in shards if s.get("repository")]
    if not configured:
        raise SystemExit("ERROR: Storage Pool has no configured repository")

    active_index = next((i for i, s in enumerate(configured) if s.get("status") == "active"), None)
    if active_index is None:
        active_index = 0

    # The existing permanent clone is the authoritative local measurement when present.
    current = configured[active_index]
    current_repo = current["repository"]
    current_dir = root / args.existing_repo_dir
    used_gb = local_lfs_gb(current_dir) if current_dir.exists() else 0.0
    threshold_reached = used_gb >= threshold

    selected = current
    reason = "active-shard-below-safe-threshold"
    if threshold_reached:
        next_shards = configured[active_index + 1 :]
        if not next_shards:
            # No configured next shard: hard stop rather than risking overage.
            raise SystemExit(
                f"ERROR: active storage shard {current_repo} is at/above the safe threshold "
                f"({used_gb:.3f} GB >= {threshold:.3f} GB) and no configured next repository exists; refusing acquisition."
            )
        selected = next_shards[0]
        if not repo_accessible(selected["repository"], token):
            raise SystemExit(
                f"ERROR: Storage Pool selected next shard {selected['repository']} but it is not accessible; refusing to route."
            )
        reason = "active-shard-threshold-reached-next-configured-shard-selected"

    out = {
        "schema": "din-allah-encyclopedia/permanent-storage-pool-route/v1",
        "storage_id": selected["id"],
        "repository": selected["repository"],
        "reason": reason,
        "measured_local_lfs_gb": round(used_gb, 6),
        "safe_storage_threshold_gb": threshold,
        "threshold_reached": threshold_reached,
        "policy": "append-only; real .pdf only; never delete, overwrite, replace, or rename existing PDFs",
    }
    out_path = root / args.output
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(out, ensure_ascii=False))
    print(f"RECHERCHER_STORAGE_ID={selected['id']}")
    print(f"RECHERCHER_STORAGE_REPO={selected['repository']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
