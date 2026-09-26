#!/usr/bin/env python3
import hashlib
import json
import os
import ssl
import sys
import subprocess
import urllib.parse
import urllib.request
from http.client import HTTPSConnection
from pathlib import Path
from huggingface_hub import HfApi

_chunk_env = os.environ.get("CHUNK_BYTES", "").strip()
CHUNK_BYTES = int(_chunk_env) if _chunk_env else 128 * 1024 * 1024
if CHUNK_BYTES <= 0 or CHUNK_BYTES > 2_000_000_000:
    raise RuntimeError("CHUNK_BYTES must be between 1 byte and 2,000,000,000 bytes")
MAX_ASSET_BYTES = 2_147_483_647
MODEL_ID = os.environ["MODEL_ID"]
REVISION = os.environ["REVISION"]
RELEASE_TAG = os.environ["RELEASE_TAG"]
LICENSE_ID = os.environ["LICENSE_ID"]
REPO = os.environ["GITHUB_REPOSITORY"]
TOKEN = os.environ["GH_TOKEN"]
RELEASE_ID = os.environ.get("OMEGA_RELEASE_ID", "").strip()

JSON_HEADERS = {
    "Accept": "application/vnd.github+json",
    "Authorization": f"Bearer {TOKEN}",
    "X-GitHub-Api-Version": "2026-03-10",
}
TLS = ssl.create_default_context()


def gh_json(path):
    """Read GitHub JSON through the authenticated gh CLI.
    This avoids draft-release REST access differences observed with direct urllib.
    """
    proc = subprocess.run(
        ["gh", "api", path],
        check=False,
        capture_output=True,
        text=True,
        env={**os.environ, "GH_TOKEN": TOKEN},
    )
    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout or "").strip()
        raise RuntimeError(f"gh api failed for {path}: {detail[:1000]}")
    return json.loads(proc.stdout)


def release_info():
    if RELEASE_ID:
        return gh_json(f"/repos/{REPO}/releases/{urllib.parse.quote(RELEASE_ID, safe='')}")
    try:
        return gh_json(f"/repos/{REPO}/releases/tags/{urllib.parse.quote(RELEASE_TAG, safe='')}")
    except urllib.error.HTTPError as exc:
        if exc.code != 404:
            raise
        # Draft releases are not addressable through the /releases/tags endpoint.
        # Fall back to the releases collection so draft releases can be resumed.
        releases = gh_json(f"/repos/{REPO}/releases?per_page=100")
        for release in releases:
            if release.get("tag_name") == RELEASE_TAG:
                return release
        raise RuntimeError(f"GitHub Release not found: {RELEASE_TAG}") from exc


def upload_asset(upload_url, name, source_response, length, content_type="application/octet-stream"):
    parsed = urllib.parse.urlsplit(upload_url)
    conn = HTTPSConnection(parsed.hostname, parsed.port or 443, context=TLS, timeout=1800)
    path = parsed.path + "?name=" + urllib.parse.quote(name, safe="")
    conn.putrequest("POST", path)
    conn.putheader("Authorization", f"Bearer {TOKEN}")
    conn.putheader("Accept", "application/vnd.github+json")
    conn.putheader("X-GitHub-Api-Version", "2026-03-10")
    conn.putheader("User-Agent", "Rechercher-Omega/1.0")
    conn.putheader("Content-Type", content_type)
    conn.putheader("Content-Length", str(length))
    conn.endheaders()

    remaining = length
    while remaining:
        data = source_response.read(min(8 * 1024 * 1024, remaining))
        if not data:
            conn.close()
            raise RuntimeError(f"Unexpected EOF while uploading {name}; {remaining} bytes remain")
        conn.send(data)
        remaining -= len(data)

    resp = conn.getresponse()
    body = resp.read()
    conn.close()
    if resp.status not in (201, 200):
        raise RuntimeError(f"GitHub upload failed for {name}: HTTP {resp.status}: {body[:1000]!r}")


def upload_bytes(upload_url, name, payload, content_type):
    from io import BytesIO
    upload_asset(upload_url, name, BytesIO(payload), len(payload), content_type)


def release_assets(release):
    """Return all release assets, including pages beyond the default page size."""
    assets = []
    page = 1
    while True:
        batch = gh_json(
            f"/repos/{REPO}/releases/{release['id']}/assets?per_page=100&page={page}"
        )
        assets.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return {a["name"]: int(a["size"]) for a in assets}


def main():
    api = HfApi()
    info = api.model_info(MODEL_ID, revision=REVISION, files_metadata=True)

    existing_release = release_info()
    # Use the dedicated assets endpoint rather than relying on the release payload's
    # embedded asset list. This makes resume detection robust for large releases
    # and avoids duplicate-upload races.
    existing = release_assets(existing_release)
    upload_url = existing_release["upload_url"].replace("{?name,label}", "")

    if "release-manifest.json" in existing:
        print(f"[SKIP] {MODEL_ID}: release-manifest.json already exists")
        return

    allowed = {".safetensors", ".bin", ".pt", ".pth", ".onnx"}
    files = []
    asset_count = 0

    for sibling in sorted(info.siblings, key=lambda s: s.rfilename):
        p = Path(sibling.rfilename)
        if p.suffix.lower() not in allowed:
            continue
        size = int(sibling.size or 0)
        if size <= 0:
            continue
        lfs = getattr(sibling, "lfs", None)
        sha = None
        if lfs is not None:
            sha = getattr(lfs, "sha256", None)
            if isinstance(lfs, dict):
                sha = lfs.get("sha256") or sha
        parts = (size + CHUNK_BYTES - 1) // CHUNK_BYTES
        asset_count += parts
        files.append({"path": sibling.rfilename, "size": size, "sha256": sha})

    if asset_count > 1000:
        raise RuntimeError(f"{MODEL_ID}: Release would require {asset_count} assets")

    manifest = []

    for item in files:
        source_path = item["path"]
        source_size = item["size"]
        source_sha = item["sha256"]
        safe = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in source_path.replace("/", "__"))
        safe_prefix = f"omega__{safe}.part-"
        existing_parts = [
            (name, size)
            for name, size in existing.items()
            if name.startswith(safe_prefix)
        ]
        # Resume legacy 512 MiB releases without colliding with the newer 128 MiB layout.
        chunk_bytes = CHUNK_BYTES
        if existing_parts:
            observed_sizes = sorted({size for name, size in existing_parts if size > 0})
            if observed_sizes:
                chunk_bytes = observed_sizes[0]
        parts = (source_size + chunk_bytes - 1) // chunk_bytes
        names = []
        hasher = hashlib.sha256()
        counted = 0

        encoded = urllib.parse.quote(source_path, safe="/")
        source_url = (
            f"https://huggingface.co/{MODEL_ID}/resolve/{REVISION}/{encoded}?download=true"
        )

        for part in range(parts):
            start = part * chunk_bytes
            end = min(source_size - 1, start + chunk_bytes - 1)
            length = end - start + 1
            asset_name = f"omega__{safe}.part-{part:04d}" if parts > 1 else f"omega__{safe}"

            if asset_name in existing and existing[asset_name] == length:
                print(f"[SKIP] existing {asset_name}")
                names.append(asset_name)
                counted += length
                continue

            req = urllib.request.Request(
                source_url,
                headers={
                    "Range": f"bytes={start}-{end}",
                    "Accept": "application/octet-stream",
                    "User-Agent": "Rechercher-Omega/1.0",
                },
            )
            print(f"[STREAM] {source_path} {start}-{end} -> {asset_name}")

            with urllib.request.urlopen(req, context=TLS, timeout=1800) as response:
                status = getattr(response, "status", None)
                remote_len = response.headers.get("Content-Length")
                if status not in (200, 206):
                    raise RuntimeError(f"HF returned HTTP {status} for {source_path}")
                if remote_len is not None and int(remote_len) != length:
                    raise RuntimeError(
                        f"Range length mismatch for {source_path}: expected {length}, got {remote_len}"
                    )

                class HashingReader:
                    def __init__(self, inner, hasher):
                        self.inner = inner
                        self.hasher = hasher
                    def read(self, n=-1):
                        data = self.inner.read(n)
                        if data:
                            self.hasher.update(data)
                        return data

                wrapped = HashingReader(response, hasher)
                try:
                    upload_asset(upload_url, asset_name, wrapped, length)
                except RuntimeError as exc:
                    # Another worker/attempt may have published the same asset after
                    # our inventory snapshot. GitHub documents HTTP 422 for an
                    # already-existing release-asset name. Refresh the authoritative
                    # asset list and accept the asset only when its size is exact.
                    message = str(exc)
                    if "HTTP 422" not in message or "already_exists" not in message:
                        raise
                    refreshed = release_assets(existing_release)
                    observed = refreshed.get(asset_name)
                    if observed != length:
                        raise RuntimeError(
                            f"Release asset collision for {asset_name}: "
                            f"expected {length} bytes, observed {observed}"
                        ) from exc
                    print(f"[SKIP-RACE] existing {asset_name} ({observed} bytes)")
                    existing.update(refreshed)
                else:
                    existing[asset_name] = length
                names.append(asset_name)
                counted += length

        if counted != source_size:
            raise RuntimeError(f"Source byte count mismatch for {source_path}: {counted} != {source_size}")

        full_sha = hasher.hexdigest()
        full_sha = source_sha or hasher.hexdigest()
        if source_sha:
            # Immutable Hugging Face/LFS SHA is authoritative and lets resumptions
            # avoid re-downloading already published Release parts.
            verified_sha = source_sha
        else:
            verified_sha = full_sha

        manifest.append({
            "source_path": source_path,
            "bytes": source_size,
            "sha256": verified_sha,
            "release_assets": names,
        })

    payload = {
        "schema_version": "1.0.0",
        "model_id": MODEL_ID,
        "revision": REVISION,
        "license": LICENSE_ID,
        "transport": "direct_hf_range_stream_python",
        "chunk_bytes": CHUNK_BYTES,
        "resume_chunk_policy": "reuse_existing_asset_size_per_source_file",
        "files": manifest,
    }
    upload_bytes(
        upload_url,
        "release-manifest.json",
        json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8") + b"\n",
        "application/json",
    )
    print(f"[DONE] {MODEL_ID}: {len(manifest)} source files published")


if __name__ == "__main__":
    main()
