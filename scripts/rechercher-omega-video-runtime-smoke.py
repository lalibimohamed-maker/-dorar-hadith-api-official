#!/usr/bin/env python3
"""Fixed smoke harness for an authorized GPU runner with pre-staged model assets.
It intentionally never downloads model weights and never accepts arbitrary shell commands.
"""
import json, os, platform, subprocess, sys
from pathlib import Path

engine=os.environ.get("ENGINE","").strip()
model_path=Path(os.environ.get("MODEL_PATH","")).expanduser()
if engine not in {"hunyuanvideo-1.5","ltx-2"}:
    raise SystemExit("unsupported engine")
if not model_path.exists():
    raise SystemExit(f"MODEL_PATH does not exist: {model_path}")
if platform.system() != "Linux":
    raise SystemExit("Linux is required for the managed video smoke path")

try:
    import torch
except Exception as exc:
    raise SystemExit(f"PyTorch unavailable: {exc}")
if not torch.cuda.is_available():
    raise SystemExit("CUDA is required")

result={
    "engine":engine,
    "model_path":str(model_path),
    "cuda_version":torch.version.cuda,
    "gpu_count":torch.cuda.device_count(),
    "gpu_names":[torch.cuda.get_device_name(i) for i in range(torch.cuda.device_count())],
    "model_assets_present":True,
    "weights_downloaded_by_runner":False,
    "e2e_generation_invoked":False,
    "status":"environment_ready_generation_command_required",

}
# A true end-to-end generation remains an explicit model-specific step; we never
# fake success merely because the weights and CUDA are present.
if engine=="hunyuanvideo-1.5":
    required = ["config.json","transformer","vae"]
elif engine=="ltx-2":
    required = ["text_encoder","transformer","audio_vae","vae","vocoder","scheduler","tokenizer"]
missing=[item for item in required if not (model_path/item).exists()]
result["missing_runtime_paths"]=missing
if missing:
    result["status"]="runtime_assets_incomplete"
    print(json.dumps(result,ensure_ascii=False,indent=2))
    raise SystemExit(1)

print(json.dumps(result,ensure_ascii=False,indent=2))
print("READY: GPU and staged engine layout verified; no end-to-end generation is claimed.")
