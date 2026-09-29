#!/usr/bin/env bash
set -euo pipefail

# Free-first bootstrap for a disposable Linux runner.
# It installs runtimes, never stores binaries/models in Git, and emits a
# machine-readable verification manifest. Model weights remain external.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${ROOT}/artifacts/engine-runtime"
mkdir -p "$OUT"

echo "[ENGINE] installing system runtimes"
sudo apt-get update
sudo apt-get install -y --no-install-recommends ffmpeg blender python3 python3-pip python3-venv

echo "[ENGINE] creating isolated Python runtime"
python3 -m venv "$OUT/venv"
# shellcheck disable=SC1091
source "$OUT/venv/bin/activate"
python -m pip install --upgrade pip setuptools wheel
python -m pip install "openai-whisper" "faster-whisper" "whisperx" "scenedetect[opencv]" "opentimelineio" "docling" "openvino"

echo "[ENGINE] optional OCR stack"
python -m pip install "paddleocr"

echo "[ENGINE] verifying binaries"
ffmpeg -version | head -n 1
ffprobe -version | head -n 1
blender --version | head -n 1
scenedetect version

echo "[ENGINE] verifying Python modules"
python - <<'PY'
import importlib.util, json, platform
mods = {
  "whisper": "whisper",
  "faster_whisper": "faster_whisper",
  "whisperx": "whisperx",
  "opentimelineio": "opentimelineio",
  "docling": "docling",
  "openvino": "openvino",
  "paddleocr": "paddleocr",
}
result = {k: bool(importlib.util.find_spec(v)) for k, v in mods.items()}
print(json.dumps({"python": platform.python_version(), "modules": result}, indent=2))
if not all(result.values()):
    raise SystemExit("engine bootstrap verification failed")
PY

cat > "$OUT/runtime-manifest.json" <<JSON
{
  "schemaVersion": "1.0.0",
  "generatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platform": "$(uname -a | sed 's/"/\\"/g')",
  "engines": {
    "ffmpeg": "$(ffmpeg -version | head -n1 | sed 's/"/\\"/g')",
    "ffprobe": "$(ffprobe -version | head -n1 | sed 's/"/\\"/g')",
    "blender": "$(blender --version | head -n1 | sed 's/"/\\"/g')",
    "scenedetect": "$(scenedetect version | head -n1 | sed 's/"/\\"/g')"
  },
  "modelsDownloaded": false,
  "corpusModified": false
}
JSON

echo "[ENGINE] bootstrap complete: $OUT/runtime-manifest.json"
