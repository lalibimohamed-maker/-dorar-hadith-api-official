#!/usr/bin/env python3
import hashlib
import json
import os
import shutil
import tarfile
import urllib.request
from pathlib import Path

from huggingface_hub import snapshot_download


MODEL_ID = os.environ["MODEL_ID"]
REVISION = os.environ["REVISION"]
SOURCE_REPO = os.environ["SOURCE_REPO"]
SOURCE_COMMIT = os.environ["SOURCE_COMMIT"]
OUTPUT_DIR = Path(os.environ["OUTPUT_DIR"])
CONFIG_PATH = Path(os.environ["CONFIG_PATH"])


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def file_inventory(root: Path):
    rows = []
    total = 0
    for path in sorted(p for p in root.rglob("*") if p.is_file()):
        rel = path.relative_to(root).as_posix()
        size = path.stat().st_size
        rows.append({"path": rel, "bytes": size, "sha256": sha256_file(path)})
        total += size
    return rows, total


def download_model_runtime_tree(destination: Path):
    ignore = [
        "*.safetensors",
        "*.bin",
        "*.pt",
        "*.pth",
        "*.onnx",
        "*.msgpack",
        "*.h5",
        "*.ckpt",
        "*.pth.tar",
        "*.tar",
        "*.tar.gz",
        "*.zip",
    ]
    allow = [
        "*.json",
        "*.yaml",
        "*.yml",
        "README*.md",
        "LICENSE",
        "NOTICE",
        ".gitattributes",
    ]
    snapshot_download(
        repo_id=MODEL_ID,
        revision=REVISION,
        local_dir=str(destination),
        allow_patterns=allow,
        ignore_patterns=ignore,
    )


def download_upstream_source(destination: Path):
    archive = destination.with_suffix(".tar.gz")
    url = f"https://github.com/{SOURCE_REPO}/archive/{SOURCE_COMMIT}.tar.gz"
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Rechercher-Omega/1.0"},
    )
    with urllib.request.urlopen(request, timeout=300) as response, archive.open("wb") as out:
        shutil.copyfileobj(response, out, length=8 * 1024 * 1024)

    extract_root = destination.parent / "upstream-extracted"
    if extract_root.exists():
        shutil.rmtree(extract_root)
    extract_root.mkdir(parents=True)
    with tarfile.open(archive, "r:gz") as tar:
        tar.extractall(extract_root, filter="data")

    candidates = [p for p in extract_root.iterdir() if p.is_dir()]
    if len(candidates) != 1:
        raise RuntimeError(f"Unexpected upstream archive layout: {[p.name for p in candidates]}")
    shutil.copytree(candidates[0], destination)
    archive.unlink(missing_ok=True)


def main():
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    model_tree = OUTPUT_DIR / "model"
    source_tree = OUTPUT_DIR / "upstream-source"
    if model_tree.exists():
        shutil.rmtree(model_tree)
    if source_tree.exists():
        shutil.rmtree(source_tree)

    download_model_runtime_tree(model_tree)
    download_upstream_source(source_tree)

    required = {
        "model": [
            "config.json",
            "scheduler/scheduler_config.json",
            "vae/config.json",
        ],
        "source": [
            "generate.py",
            "requirements.txt",
            "hyvideo/__init__.py",
            "hyvideo/pipelines/hunyuan_video_pipeline.py",
        ],
    }
    for group, paths in required.items():
        root = model_tree if group == "model" else source_tree
        missing = [path for path in paths if not (root / path).is_file()]
        if missing:
            raise RuntimeError(f"Missing required {group} runtime files: {missing}")

    model_inventory, model_bytes = file_inventory(model_tree)
    source_inventory, source_bytes = file_inventory(source_tree)

    runtime_manifest = {
        "schema_version": "1.0.0",
        "artifact_scope": "hunyuanvideo15_runtime_only",
        "model_id": MODEL_ID,
        "model_revision": REVISION,
        "upstream_repo": SOURCE_REPO,
        "upstream_commit": SOURCE_COMMIT,
        "model_runtime_files": {
            "root": "model/",
            "count": len(model_inventory),
            "bytes": model_bytes,
            "files": model_inventory,
        },
        "upstream_source": {
            "root": "upstream-source/",
            "count": len(source_inventory),
            "bytes": source_bytes,
            "files": source_inventory,
        },
        "weights_reference": "release-manifest.json",
        "completeness_semantics": "This manifest covers runtime/config/source assets only; release-manifest.json covers model weights only.",
    }

    dependencies = {
        "schema_version": "1.0.0",
        "model_id": MODEL_ID,
        "model_revision": REVISION,
        "dependencies": config["external_dependencies"],
        "official_download_basis": "Tencent-Hunyuan/HunyuanVideo-1.5/checkpoints-download.md",
        "note": "External dependencies are not silently treated as present. Gated or rights-review dependencies keep the engine non-runnable until explicitly cleared.",
    }

    readiness = {
        "schema_version": "1.0.0",
        "model_id": MODEL_ID,
        "model_revision": REVISION,
        "core_weights": "acquired",
        "core_runtime_bundle": "complete",
        "upstream_source": "pinned_and_packaged",
        "license_notice": "attached_separately",
        "external_dependencies": "blocked_or_not_embedded",
        "runnable": False,
        "status": "dependency_blocked",
        "blocking_dependencies": [
            d["id"] for d in config["external_dependencies"]
            if d["status"] != "public_dependency_not_embedded"
        ],
        "public_dependencies_available_but_not_embedded": [
            d["id"] for d in config["external_dependencies"]
            if d["status"] == "public_dependency_not_embedded"
        ],
        "promotion_rule": "Never mark this Release runnable/complete from release-manifest.json alone.",
    }

    (OUTPUT_DIR / "hunyuanvideo15-runtime-manifest.json").write_text(
        json.dumps(runtime_manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (OUTPUT_DIR / "hunyuanvideo15-dependencies.json").write_text(
        json.dumps(dependencies, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (OUTPUT_DIR / "hunyuanvideo15-release-readiness.json").write_text(
        json.dumps(readiness, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    bundle = OUTPUT_DIR / "omega__hunyuanvideo15__runtime.tar.gz"
    with tarfile.open(bundle, "w:gz") as tar:
        tar.add(model_tree, arcname="model")
        tar.add(source_tree, arcname="upstream-source")

    print("[DONE] HunyuanVideo 1.5 runtime bundle prepared")
    print("Bundle:", bundle)
    print("Bundle SHA256:", sha256_file(bundle))
    print("Model runtime files:", len(model_inventory), model_bytes, "bytes")
    print("Upstream source files:", len(source_inventory), source_bytes, "bytes")


if __name__ == "__main__":
    main()
