#!/usr/bin/env python3
"""Audit and repair multipart video-model assets in a private Omega Release.

Audit mode is read-only. Repair mode downloads only missing or size-mismatched
Release parts from the pinned Hugging Face revision using HfFileSystem seek/read,
then uploads those exact parts to the existing private Release.

No model weights are committed to Git or Corpus.
"""
from __future__ import annotations

import hashlib
import json
import os
import ssl
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path
from http.client import HTTPSConnection

from huggingface_hub import HfFileSystem

REPO = os.environ["OMEGA_STORAGE_REPOSITORY"]
TAG = os.environ["OMEGA_STORAGE_RELEASE_TAG"]
MODEL_ID = os.environ.get("MODEL_ID", "").strip()
REVISION = os.environ.get("REVISION", "").strip()
TOKEN = os.environ["GH_TOKEN"]
HF_TOKEN = os.environ.get("HF_TOKEN", "").strip()
AUDIT_ONLY = os.environ.get("AUDIT_ONLY", "false").strip().lower() == "true"
CHUNK_ENV = os.environ.get("CHUNK_BYTES", "").strip()
DEFAULT_CHUNK_BYTES = 512 * 1024 * 1024
CHUNK_BYTES = int(CHUNK_ENV) if CHUNK_ENV else DEFAULT_CHUNK_BYTES
if CHUNK_BYTES <= 0 or CHUNK_BYTES > 2_000_000_000:
    raise RuntimeError("CHUNK_BYTES must be between 1 byte and 2,000,000,000 bytes")
if not REPO or "/" not in REPO:
    raise RuntimeError("OMEGA_STORAGE_REPOSITORY must be owner/name")
if not TAG:
    raise RuntimeError("OMEGA_STORAGE_RELEASE_TAG is required")
if not TOKEN:
    raise RuntimeError("GH_TOKEN is required")


def gh_json(path: str):
    proc = subprocess.run(
        ["gh", "api", path],
        check=False,
        capture_output=True,
        text=True,
        env={**os.environ, "GH_TOKEN": TOKEN},
    )
    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout or "").strip()
        raise RuntimeError(f"gh api failed for {path}: {detail[:1200]}")
    return json.loads(proc.stdout)


def release_info():
    releases = gh_json("/repos/%s/releases?per_page=100" % REPO)
    for release in releases:
        if release.get("tag_name") == TAG:
            return release
    raise RuntimeError(f"GitHub Release not found: {TAG}")


def release_assets(release: dict) -> dict[str, dict]:
    out = {}
    page = 1
    while True:
        batch = gh_json(
            f"/repos/{REPO}/releases/{release['id']}/assets?per_page=100&page={page}"
        )
        for item in batch:
            out[item["name"]] = item
        if len(batch) < 100:
            return out
        page += 1


def download_manifest(release: dict) -> dict:
    assets = release_assets(release)
    meta = assets.get("release-manifest.json")
    if not meta:
        raise RuntimeError("release-manifest.json is missing")
    request = urllib.request.Request(
        meta["browser_download_url"],
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Accept": "application/octet-stream",
            "User-Agent": "Rechercher-Omega-Video-Release-Repair/1.0",
        },
    )
    context = ssl.create_default_context()
    with urllib.request.urlopen(request, context=context, timeout=180) as response:
        return json.load(response)


def expected_part_lengths(size: int, chunk_bytes: int) -> list[int]:
    if size <= 0:
        return []
    parts = (size + chunk_bytes - 1) // chunk_bytes
    return [
        min(chunk_bytes, size - index * chunk_bytes)
        for index in range(parts)
    ]


def expected_assets(item: dict, chunk_bytes: int) -> list[tuple[str, int]]:
    source_path = str(item["source_path"])
    source_size = int(item["bytes"])
    declared = list(item.get("release_assets", []))
    safe = "".join(
        ch if ch.isalnum() or ch in "._-" else "_"
        for ch in source_path.replace("/", "__")
    )
    lengths = expected_part_lengths(source_size, chunk_bytes)
    if len(lengths) == 1 and len(declared) == 1 and declared[0] == f"omega__{safe}":
        return [(declared[0], lengths[0])]
    if len(declared) != len(lengths):
        raise RuntimeError(
            f"Manifest part count mismatch for {source_path}: "
            f"declared={len(declared)} expected={len(lengths)}"
        )
    expected = []
    for index, (name, length) in enumerate(zip(declared, lengths)):
        canonical = f"omega__{safe}.part-{index:04d}"
        if name != canonical:
            raise RuntimeError(
                f"Manifest part ordering/name mismatch for {source_path}: "
                f"{name} != {canonical}"
            )
        expected.append((name, length))
    return expected


def audit(release: dict, manifest: dict, assets: dict[str, dict]):
    chunk_bytes = int(manifest.get("chunk_bytes", CHUNK_BYTES))
    missing = []
    wrong_size = []
    total_sources = 0
    total_expected_bytes = 0
    total_present_bytes = 0

    for item in manifest.get("files", []):
        source_path = str(item["source_path"])
        source_size = int(item["bytes"])
        total_sources += 1
        total_expected_bytes += source_size
        for name, length in expected_assets(item, chunk_bytes):
            meta = assets.get(name)
            if not meta:
                missing.append({"source_path": source_path, "asset": name, "expected_bytes": length})
                continue
            present = int(meta["size"])
            total_present_bytes += present
            if present != length:
                wrong_size.append(
                    {
                        "source_path": source_path,
                        "asset": name,
                        "expected_bytes": length,
                        "actual_bytes": present,
                    }
                )

    result = {
        "repository": REPO,
        "release_tag": TAG,
        "model_id": MODEL_ID or manifest.get("model_id"),
        "revision": REVISION or manifest.get("revision"),
        "release_draft": release.get("draft"),
        "release_prerelease": release.get("prerelease"),
        "manifest_chunk_bytes": chunk_bytes,
        "source_file_count": total_sources,
        "expected_source_bytes": total_expected_bytes,
        "present_manifest_asset_bytes": total_present_bytes,
        "missing_count": len(missing),
        "wrong_size_count": len(wrong_size),
        "missing": missing,
        "wrong_size": wrong_size,
        "status": "complete" if not missing and not wrong_size else "incomplete",
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return result


def upload_asset(upload_url: str, name: str, payload, length: int):
    parsed = urllib.parse.urlsplit(upload_url)
    conn = HTTPSConnection(parsed.hostname, parsed.port or 443, context=ssl.create_default_context(), timeout=1800)
    path = parsed.path + "?name=" + urllib.parse.quote(name, safe="")
    conn.putrequest("POST", path)
    conn.putheader("Authorization", f"Bearer {TOKEN}")
    conn.putheader("Accept", "application/vnd.github+json")
    conn.putheader("X-GitHub-Api-Version", "2026-03-10")
    conn.putheader("User-Agent", "Rechercher-Omega-Video-Release-Repair/1.0")
    conn.putheader("Content-Type", "application/octet-stream")
    conn.putheader("Content-Length", str(length))
    conn.endheaders()

    remaining = length
    while remaining:
        data = payload.read(min(8 * 1024 * 1024, remaining))
        if not data:
            conn.close()
            raise RuntimeError(f"Unexpected EOF uploading {name}; {remaining} bytes remain")
        conn.send(data)
        remaining -= len(data)

    response = conn.getresponse()
    body = response.read()
    conn.close()
    if response.status not in (200, 201):
        raise RuntimeError(f"GitHub upload failed for {name}: HTTP {response.status}: {body[:1000]!r}")


def delete_asset(name: str):
    proc = subprocess.run(
        ["gh", "release", "delete-asset", TAG, name, "--repo", REPO, "--yes"],
        check=False,
        capture_output=True,
        text=True,
        env={**os.environ, "GH_TOKEN": TOKEN},
    )
    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout or "").strip()
        raise RuntimeError(f"failed to delete stale asset {name}: {detail[:1200]}")


def repair(release: dict, manifest: dict, initial_assets: dict[str, dict], audit_result: dict):
    if not MODEL_ID or not REVISION:
        raise RuntimeError("MODEL_ID and REVISION are required for repair mode")

    chunk_bytes = int(manifest.get("chunk_bytes", CHUNK_BYTES))
    fs = HfFileSystem(token=HF_TOKEN or None, block_size=8 * 1024 * 1024)
    upload_url = release["upload_url"].replace("{?name,label}", "")
    repaired = []

    wanted = audit_result["missing"] + audit_result["wrong_size"]
    for row in wanted:
        item = next(
            x for x in manifest["files"] if str(x["source_path"]) == row["source_path"]
        )
        asset_name = row["asset"]
        expected = int(row["expected_bytes"])
        observed = row.get("actual_bytes")
        if observed is not None:
            delete_asset(asset_name)

        source_path = str(item["source_path"])
        expected_source_size = int(item["bytes"])
        source_sha = str(item["sha256"])
        part_index = next(
            index
            for index, (name, length) in enumerate(expected_assets(item, chunk_bytes))
            if name == asset_name
        )
        offset = part_index * chunk_bytes

        with fs.open(f"hf://{MODEL_ID}@{REVISION}/{source_path}", "rb") as remote:
            remote.seek(offset)
            remaining = expected
            hasher = hashlib.sha256()

            class LimitedReader:
                def __init__(self, source):
                    self.source = source
                    self.remaining = remaining

                def read(self, size=-1):
                    want = self.remaining if size < 0 else min(size, self.remaining)
                    if want <= 0:
                        return b""
                    data = self.source.read(want)
                    if not data:
                        raise RuntimeError(
                            f"Unexpected EOF from Hugging Face for {source_path} at offset {offset}"
                        )
                    self.remaining -= len(data)
                    hasher.update(data)
                    return data

            limited = LimitedReader(remote)
            upload_asset(upload_url, asset_name, limited, expected)

        part_sha = hasher.hexdigest()
        repaired.append(
            {
                "source_path": source_path,
                "asset": asset_name,
                "offset": offset,
                "bytes": expected,
                "part_sha256": part_sha,
                "source_sha256": source_sha,
                "source_bytes": expected_source_size,
            }
        )
        print(f"[REPAIRED] {asset_name} bytes={expected} offset={offset}")

    refreshed = release_assets(release)
    final = audit(release, manifest, refreshed)
    if final["status"] != "complete":
        raise RuntimeError("Release remains incomplete after targeted repair")

    record = {
        "schema_version": "1.0.0",
        "repair_type": "targeted_missing_or_wrong_size_release_parts",
        "model_id": MODEL_ID,
        "revision": REVISION,
        "release_tag": TAG,
        "repaired_assets": repaired,
        "post_repair_status": "complete",
    }
    temp = Path(os.environ.get("RUNNER_TEMP", "/tmp")) / "omega-video-release-repair.json"
    temp.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with temp.open("rb") as fh:
        upload_asset(upload_url, "video-release-repair-latest.json", fh, temp.stat().st_size)


def main():
    release = release_info()
    assets = release_assets(release)
    manifest = download_manifest(release)
    result = audit(release, manifest, assets)
    if AUDIT_ONLY:
        if result["status"] != "complete":
            raise SystemExit(1)
        return
    if result["status"] == "complete":
        print("[OK] Release is complete; no repair required.")
        return
    repair(release, manifest, assets, result)


if __name__ == "__main__":
    main()
