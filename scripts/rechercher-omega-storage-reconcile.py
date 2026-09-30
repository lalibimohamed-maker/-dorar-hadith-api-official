#!/usr/bin/env python3
"""Verify Rechercher Omega release presence across every authoritative storage target.

The verifier is intentionally read-only. It checks both the primary repository
and the dedicated Omega engine storage repository before acquisition proceeds.
A complete release in either target is authoritative for duplicate prevention.
"""
import json
import os
import subprocess
import sys

MANIFEST = os.environ.get("OMEGA_COMPLETE_MANIFEST_ASSET", "release-manifest.json")
TARGETS = [
    ("primary", os.environ.get("OMEGA_PRIMARY_REPOSITORY", "lalibimohamed-maker/-dorar-hadith-api-official")),
    ("omega-engine-storage", os.environ.get("OMEGA_STORAGE_REPOSITORY", "lalibimohamed-maker/rechercher-omega-engine-storage")),
]
TAG = os.environ["OMEGA_RELEASE_TAG"]

def gh_release(repo: str):
    p = subprocess.run(
        ["gh", "api", f"repos/{repo}/releases/tags/{TAG}"],
        text=True, capture_output=True, check=False
    )
    if p.returncode != 0:
        return None
    return json.loads(p.stdout)

found = {}
complete_targets = []
for target_id, repo in TARGETS:
    data = gh_release(repo)
    assets = {a.get("name") for a in (data or {}).get("assets", [])}
    model_assets = sorted(name for name in assets if str(name).startswith("omega__"))
    complete = MANIFEST in assets and bool(model_assets)
    found[target_id] = {
        "repository": repo,
        "release_tag": TAG,
        "release_exists": data is not None,
        "complete": complete,
        "asset_count": len(assets),
        "model_asset_count": len(model_assets),
        "manifest_asset": MANIFEST if complete else None,
    }
    if complete:
        complete_targets.append(target_id)

result = {
    "release_tag": TAG,
    "manifest_asset": MANIFEST,
    "complete_anywhere": bool(complete_targets),
    "complete_targets": complete_targets,
    "targets": found,
}
print(json.dumps(result, indent=2, sort_keys=True))

out = os.environ.get("GITHUB_OUTPUT")
if out:
    with open(out, "a", encoding="utf-8") as f:
        f.write(f"complete_anywhere={'true' if complete_targets else 'false'}\n")
        f.write("complete_targets=" + ",".join(complete_targets) + "\n")
        f.write("verification_json=" + json.dumps(result, separators=(",", ":")) + "\n")

if os.environ.get("OMEGA_REQUIRE_DUAL_STORAGE", "false").lower() == "true" and len(complete_targets) != 2:
    sys.exit(2)
