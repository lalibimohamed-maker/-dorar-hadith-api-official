#!/usr/bin/env python3
import hashlib
import json
import os
import ssl
import sys
import urllib.parse
import urllib.request
from http.client import HTTPSConnection
from pathlib import Path
from huggingface_hub import HfApi

CHUNK_BYTES = 128 * 1024 * 1024
MAX_ASSET_BYTES = 2_147_483_647
MODEL_ID = os.environ["MODEL_ID"]
REVISION = os.environ["REVISION"]
RELEASE_TAG = os.environ["RELEASE_TAG"]
LICENSE_ID = os.environ["LICENSE_ID"]
REPO = os.environ["GITHUB_REPOSITORY"]
TOKEN = os.environ["GH_TOKEN"]

JSON_HEADERS = {
    "Accept": "application/vnd.github+json",
    "Authorization": f"Bearer {TOKEN}",
    "X-GitHub-Api-Version": "2026-03-10",
}
TLS = ssl.create_default_context()


def gh_json(path):
    req = urllib.request.Request(f"https://api.github.com{path}", headers=JSON_HEADERS)
    with urllib.request.urlopen(req, context=TLS, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def release_info():
    return gh_json(f"/repos/{REPO}/releases/tags/{urllib.parse.quote(RELEASE_TAG, safe='')}")


def upload_asset(upload_url, name, source_response, length, content_type="application/octet-stream"):
    parsed = urllib.parse.urlsplit(upload_url)
    conn = HTTPSConnection(parsed.hostname, parsed.port or 443, context=TLS, timeout=1800)
    path = parsed.path + "?name=" + urllib.parse.quote(name, safe="")
    conn.putrequest("POST", path)
    conn.putheader("Authorization", f"Bearer {TOKEN}")
    conn.putheader("Accept", "application/vnd.github+json")
    conn.putheader("X-GitHub-Api-Version", "2026-03-10")
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


def main():
    api = HfApi()
    info = api.model_info(MODEL_ID, revision=REVISION, files_metadata=True)

    existing_release = release_info()
    existing = {a["name"]: int(a["size"]) for a in existing_release.get("assets", [])}
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
        parts = (source_size + CHUNK_BYTES - 1) // CHUNK_BYTES
        names = []
        hasher = hashlib.sha256()
        counted = 0

        encoded = urllib.parse.quote(source_path, safe="/")
        source_url = (
            f"https://huggingface.co/{MODEL_ID}/resolve/{REVISION}/{encoded}?download=true"
        )

        for part in range(parts):
            start = part * CHUNK_BYTES
            end = min(source_size - 1, start + CHUNK_BYTES - 1)
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
                upload_asset(upload_url, asset_name, wrapped, length)
                existing[asset_name] = length
                names.append(asset_name)
                counted += length

        if counted != source_size:
            raise RuntimeError(f"Source byte count mismatch for {source_path}: {counted} != {source_size}")

        full_sha = hasher.hexdigest()
        if source_sha and full_sha != source_sha:
            raise RuntimeError(f"SHA-256 mismatch for {source_path}: {full_sha} != {source_sha}")

        manifest.append({
            "source_path": source_path,
            "bytes": source_size,
            "sha256": source_sha or full_sha,
            "release_assets": names,
        })

    payload = {
        "schema_version": "1.0.0",
        "model_id": MODEL_ID,
        "revision": REVISION,
        "license": LICENSE_ID,
        "transport": "direct_hf_range_stream_python",
        "chunk_bytes": CHUNK_BYTES,
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
