#!/usr/bin/env python3
"""Selective, resumable materializer for Rechercher Ω private Release weights.

The script downloads only manifest-selected source files, streams each Release
asset with HTTP Range, reconstructs the original source file on disk, verifies
the source SHA-256 from release-manifest.json, and keeps the resume state local.
It never loads a complete model into memory.
"""

from __future__ import annotations

import fnmatch
import hashlib
import json
import os
import ssl
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

REPO = os.environ["OMEGA_STORAGE_REPOSITORY"]
TAG = os.environ["OMEGA_STORAGE_RELEASE_TAG"]
OUTPUT_DIR = Path(os.environ.get("OMEGA_MATERIALIZE_DIR", "./.omega-model"))
PATTERNS = [p.strip() for p in os.environ.get("OMEGA_SOURCE_PATTERNS", "").split(",") if p.strip()]
EXACT_PATHS = [p.strip() for p in os.environ.get("OMEGA_SOURCE_PATHS", "").split(",") if p.strip()]
PROFILE_CONFIG = os.environ.get("OMEGA_PROFILE_CONFIG", "config/rechercher-omega-video-engine-profiles-2026.json")
ENGINE_ID = os.environ.get("OMEGA_VIDEO_ENGINE_ID", "").strip()
PROFILE_ID = os.environ.get("OMEGA_VIDEO_PROFILE_ID", "").strip()
CHUNK_BYTES = 8 * 1024 * 1024
TLS = ssl.create_default_context()


def gh_json(path: str) -> Any:
    proc = subprocess.run(
        ["gh", "api", path],
        check=False,
        capture_output=True,
        text=True,
        env={**os.environ, "GH_TOKEN": os.environ.get("GH_TOKEN", "")},
    )
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout).strip()[:2000])
    return json.loads(proc.stdout)


def release_assets() -> dict[str, dict[str, Any]]:
    rel = gh_json(f"/repos/{REPO}/releases/tags/{TAG}")
    out: dict[str, dict[str, Any]] = {}
    page = 1
    while True:
        batch = gh_json(
            f"/repos/{REPO}/releases/{rel['id']}/assets?per_page=100&page={page}"
        )
        for item in batch:
            out[item["name"]] = {
                "id": item["id"],
                "size": int(item["size"]),
                "digest": item.get("digest"),
                "browser_download_url": item["browser_download_url"],
            }
        if len(batch) < 100:
            break
        page += 1
    return out


def fetch_manifest(assets: dict[str, dict[str, Any]]) -> dict[str, Any]:
    meta = assets.get("release-manifest.json")
    if not meta:
        raise RuntimeError("release-manifest.json is missing")
    request = urllib.request.Request(
        meta["browser_download_url"],
        headers={
            "Authorization": f"Bearer {os.environ['GH_TOKEN']}",
            "Accept": "application/octet-stream",
            "User-Agent": "Rechercher-Omega-Materializer/1.0",
        },
    )
    with urllib.request.urlopen(request, context=TLS, timeout=120) as response:
        return json.load(response)


def download_range(url: str, start: int, expected: int, output) -> int:
    headers = {
        "Authorization": f"Bearer {os.environ['GH_TOKEN']}",
        "Accept": "application/octet-stream",
        "User-Agent": "Rechercher-Omega-Materializer/1.0",
    }
    if start:
        headers["Range"] = f"bytes={start}-{start + expected - 1}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, context=TLS, timeout=1800) as response:
        status = getattr(response, "status", response.getcode())
        if start and status != 206:
            raise RuntimeError(
                f"server did not honor HTTP Range resume for asset: status={status}"
            )
        if not start and status not in (200, 206):
            raise RuntimeError(f"unexpected asset response status={status}")
        written = 0
        while written < expected:
            data = response.read(min(CHUNK_BYTES, expected - written))
            if not data:
                raise RuntimeError(
                    f"unexpected EOF while reading asset; need {expected - written} more bytes"
                )
            output.write(data)
            written += len(data)
    return written


def atomic_state(path: Path, state: dict[str, Any]) -> None:
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temp, path)


def load_profile_prefixes() -> list[str]:
    if not ENGINE_ID or not PROFILE_ID:
        return []
    config = json.loads(Path(PROFILE_CONFIG).read_text(encoding="utf-8"))
    key = "hunyuanvideo15" if ENGINE_ID == "hunyuanvideo-1.5" else "ltx2" if ENGINE_ID == "ltx-2" else None
    if not key or key not in config:
        raise RuntimeError(f"unsupported video profile engine: {ENGINE_ID}")
    profile = next((p for p in config[key].get("profiles", []) if p.get("id") == PROFILE_ID), None)
    if not profile:
        raise RuntimeError(f"unknown video profile: {ENGINE_ID}/{PROFILE_ID}")
    prefixes = [str(x) for x in profile.get("release_asset_prefixes", []) if str(x)]
    if not prefixes:
        raise RuntimeError(f"video profile has no release asset prefixes: {ENGINE_ID}/{PROFILE_ID}")
    return prefixes

PROFILE_PREFIXES = load_profile_prefixes()

def matches(source_path: str, release_assets: list[str] | None = None) -> bool:
    if EXACT_PATHS and source_path in EXACT_PATHS:
        return True
    if PATTERNS and any(fnmatch.fnmatch(source_path, pat) for pat in PATTERNS):
        return True
    if PROFILE_PREFIXES and release_assets:
        return any(
            any(str(asset).startswith(prefix) for prefix in PROFILE_PREFIXES)
            for asset in release_assets
        )
    return not EXACT_PATHS and not PATTERNS and not PROFILE_PREFIXES


def materialize_source(item: dict[str, Any], assets: dict[str, dict[str, Any]]) -> dict[str, Any]:
    source_path = str(item["source_path"])
    destination = OUTPUT_DIR / source_path
    destination.parent.mkdir(parents=True, exist_ok=True)
    state_path = destination.with_suffix(destination.suffix + ".omega-state.json")
    state = {
        "source_path": source_path,
        "source_size": int(item["bytes"]),
        "source_sha256": item["sha256"],
        "release_assets": list(item["release_assets"]),
        "completed_asset_index": 0,
        "asset_offset": 0,
        "output_bytes": 0,
    }
    if state_path.exists():
        state.update(json.loads(state_path.read_text(encoding="utf-8")))

    expected_size = int(item["bytes"])
    expected_sha = item["sha256"]

    with open(destination, "ab+") as output:
        output.flush()
        recorded = int(state["output_bytes"])
        output_size = output.tell()
        if output_size != recorded:
            output.truncate(0)
            output.seek(0)
            state["completed_asset_index"] = 0
            state["asset_offset"] = 0
            state["output_bytes"] = 0
        else:
            output.seek(recorded)

        for idx, asset_name in enumerate(item["release_assets"]):
            meta = assets.get(asset_name)
            if not meta:
                raise RuntimeError(f"release asset missing: {asset_name}")
            asset_size = int(meta["size"])
            offset = int(state["asset_offset"]) if idx == int(state["completed_asset_index"]) else 0
            if idx < int(state["completed_asset_index"]):
                continue

            if offset > asset_size:
                raise RuntimeError(f"resume offset exceeds asset size for {asset_name}")

            if offset < asset_size:
                output.flush()
                output.seek(int(state["output_bytes"]))
                written = download_range(
                    meta["browser_download_url"],
                    offset,
                    asset_size - offset,
                    output,
                )
                state["output_bytes"] = int(state["output_bytes"]) + written
                state["asset_offset"] = asset_size
                output.flush()
                os.fsync(output.fileno())

            state["completed_asset_index"] = idx + 1
            state["asset_offset"] = 0
            atomic_state(state_path, state)

        output.flush()
        os.fsync(output.fileno())

    if state["output_bytes"] != expected_size:
        raise RuntimeError(
            f"source size mismatch for {source_path}: {state['output_bytes']} != {expected_size}"
        )

    hasher = hashlib.sha256()
    with open(destination, "rb") as source:
        while True:
            block = source.read(CHUNK_BYTES)
            if not block:
                break
            hasher.update(block)
    actual_sha = hasher.hexdigest()
    if actual_sha != expected_sha:
        raise RuntimeError(
            f"SHA-256 mismatch for {source_path}: {actual_sha} != {expected_sha}"
        )

    state["status"] = "verified"
    atomic_state(state_path, state)
    state_path.unlink(missing_ok=True)
    return {
        "source_path": source_path,
        "bytes": expected_size,
        "sha256": actual_sha,
        "destination": str(destination),
        "status": "verified",
    }


def main() -> int:
    if "/" not in REPO:
        raise SystemExit("OMEGA_STORAGE_REPOSITORY must be owner/name")
    if not os.environ.get("GH_TOKEN"):
        raise SystemExit("GH_TOKEN is required for private Release access")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    assets = release_assets()
    manifest = fetch_manifest(assets)
    revision = manifest.get("revision")
    print(f"[OMEGA] release={TAG} revision={revision} engine={ENGINE_ID or '-'} profile={PROFILE_ID or '-'}")

    selected = [
        item
        for item in manifest.get("files", [])
        if matches(str(item.get("source_path", "")), item.get("release_assets", []))
    ]
    if not selected:
        raise SystemExit("No manifest source files matched the requested selection")

    results = []
    for item in selected:
        print(f"[MATERIALIZE] {item['source_path']}")
        results.append(materialize_source(item, assets))

    summary = {
        "repository": REPO,
        "release_tag": TAG,
        "revision": revision,
        "selected_files": results,
        "status": "verified",
        "complete_release_materialized": False,
        "engine_id": ENGINE_ID or None,
        "profile_id": PROFILE_ID or None,
    }
    summary_path = OUTPUT_DIR / "omega-materialization-summary.json"
    summary_path.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(summary_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
