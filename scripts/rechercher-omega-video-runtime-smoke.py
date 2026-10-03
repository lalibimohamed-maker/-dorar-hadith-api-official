#!/usr/bin/env python3
"""Profile-aware smoke harness for an authorized GPU runner.

Verifies CUDA plus the selected/default profile's staged assets. It never
downloads model weights and never claims that model inference ran; actual
generation is performed only by the guarded generation workflow.
"""
from __future__ import annotations

import json
import os
import platform
import sys
from pathlib import Path

CONFIG_PATH = Path(
    os.environ.get(
        "OMEGA_VIDEO_PROFILE_CONFIG",
        "config/rechercher-omega-video-engine-profiles-2026.json",
    )
)
ENGINE = os.environ.get("ENGINE", "").strip()
PROFILE = os.environ.get("PROFILE", "").strip()
MODEL_PATH = Path(os.environ.get("MODEL_PATH", "")).expanduser()
GEMMA_ROOT = Path(os.environ.get("GEMMA_ROOT", "")).expanduser()
REQUIRE_EXTERNAL_DEPENDENCIES = (
    os.environ.get("REQUIRE_EXTERNAL_DEPENDENCIES", "false").strip().lower() == "true"
)
REQUIRE_RUNTIME_BUNDLE = (
    os.environ.get("REQUIRE_RUNTIME_BUNDLE", "false").strip().lower() == "true"
)


def fail(message: str) -> None:
    raise SystemExit(message)


if ENGINE not in {"hunyuanvideo-1.5", "ltx-2"}:
    fail("unsupported engine")
if not str(MODEL_PATH):
    fail("MODEL_PATH is required")
if not MODEL_PATH.exists():
    fail(f"MODEL_PATH does not exist: {MODEL_PATH}")
if platform.system() != "Linux":
    fail("Linux is required for the managed video smoke path")
if not CONFIG_PATH.is_file():
    fail(f"profile config missing: {CONFIG_PATH}")

try:
    import torch
except Exception as exc:
    fail(f"PyTorch unavailable: {exc}")

if not torch.cuda.is_available():
    fail("CUDA is required")

config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
engine_key = "ltx2" if ENGINE == "ltx-2" else "hunyuanvideo15"
engine_cfg = config[engine_key]

if not PROFILE:
    PROFILE = str(engine_cfg.get("default_profile", "")).strip()
if not PROFILE:
    fail(f"no default profile configured for {ENGINE}")

profiles = {str(item["id"]): item for item in engine_cfg.get("profiles", [])}
profile = profiles.get(PROFILE)
if profile is None:
    fail(f"unknown profile: {ENGINE}/{PROFILE}")

missing: list[str] = []
matched: list[str] = []
notes: list[str] = []


def find_file(name: str) -> Path | None:
    direct = MODEL_PATH / name
    if direct.is_file() and direct.stat().st_size > 0:
        return direct
    for candidate in MODEL_PATH.rglob(name):
        if candidate.is_file() and candidate.stat().st_size > 0:
            return candidate
    return None


def find_path_component(name: str) -> Path | None:
    direct = MODEL_PATH / name
    if direct.exists():
        if direct.is_file() and direct.stat().st_size == 0:
            return None
        return direct
    for candidate in MODEL_PATH.rglob(name):
        if candidate.exists():
            if candidate.is_file() and candidate.stat().st_size == 0:
                continue
            return candidate
    return None


def require_component(name: str) -> None:
    found = find_path_component(name)
    if found:
        matched.append(str(found.relative_to(MODEL_PATH)))
    else:
        missing.append(name)


if ENGINE == "ltx-2":
    primary = str(profile.get("model_weight", "")).strip()
    if primary and "split transformer/text-encoder component set" not in primary:
        require_component(primary)

    for requirement in profile.get("requires", []):
        requirement = str(requirement).strip()
        if requirement == "spatial_upscaler":
            require_component("ltx-2-spatial-upscaler-x2-1.0.safetensors")
        elif requirement == "external_gemma_root":
            if not GEMMA_ROOT:
                if REQUIRE_EXTERNAL_DEPENDENCIES:
                    missing.append("GEMMA_ROOT")
                else:
                    notes.append("external Gemma dependency not checked in this smoke mode")
            elif not GEMMA_ROOT.is_dir():
                missing.append("GEMMA_ROOT")
            else:
                files = [
                    p for p in GEMMA_ROOT.rglob("*")
                    if p.is_file() and p.stat().st_size > 0
                ]
                if files:
                    matched.append(f"GEMMA_ROOT:{len(files)} files")
                else:
                    missing.append("GEMMA_ROOT(no non-empty files)")
        elif requirement:
            require_component(requirement)

    if PROFILE == "distilled-diffusers-split":
        split_components = [
            "audio_vae",
            "connectors",
            "latent_upsampler",
            "text_encoder",
            "tokenizer",
            "transformer",
            "vae",
            "vocoder",
            "scheduler",
        ]
        for component in split_components:
            if component not in profile.get("requires", []):
                require_component(component)

elif ENGINE == "hunyuanvideo-1.5":
    transformer = str(profile.get("transformer_asset_prefix", "")).strip()
    transformer_name = Path(transformer).name if transformer else ""
    if transformer_name:
        require_component(transformer_name)
    else:
        missing.append("transformer_asset_prefix")

    if REQUIRE_RUNTIME_BUNDLE:
        manifest_name = "hunyuanvideo15-runtime-manifest.json"
        if find_file(manifest_name):
            matched.append(manifest_name)
        else:
            missing.append(manifest_name)

result = {
    "engine": ENGINE,
    "profile": PROFILE,
    "model_path": str(MODEL_PATH),
    "cuda_version": torch.version.cuda,
    "gpu_count": torch.cuda.device_count(),
    "gpu_names": [
        torch.cuda.get_device_name(i) for i in range(torch.cuda.device_count())
    ],
    "matched_assets": matched,
    "missing_runtime_paths": missing,
    "notes": notes,
    "weights_downloaded_by_runner": False,
    "e2e_generation_invoked": False,
    "status": "runtime_assets_incomplete"
    if missing
    else "environment_ready_generation_command_required",
}

print(json.dumps(result, ensure_ascii=False, indent=2))

if missing:
    fail("required assets for the selected/default profile are missing")

print("READY: GPU and profile-specific staged assets verified; no end-to-end generation is claimed.")
