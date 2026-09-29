#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/artifacts/engine-runtime"
mkdir -p "$OUT"
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update
sudo apt-get install -y --no-install-recommends ffmpeg blender kdenlive audacity python3 python3-venv python3-pip jq curl
python3 -m venv "$OUT/venv"
source "$OUT/venv/bin/activate"
python -m pip install --upgrade pip setuptools wheel
python -m pip install "openai-whisper" "faster-whisper" "whisperx" "scenedetect[opencv]" "opentimelineio" "docling" "openvino" "paddleocr" "qdrant-client" "piper-tts" "kokoro"
python - <<'PY'
import importlib.util
mods={"whisper":"whisper","faster-whisper":"faster_whisper","whisperx":"whisperx","opentimelineio":"opentimelineio","docling":"docling","openvino":"openvino","paddleocr-vl":"paddleocr","qdrant-client":"qdrant_client","kokoro":"kokoro","piper":"piper"}
bad=[k for k,v in mods.items() if not importlib.util.find_spec(v)]
print({"missing":bad})
if bad: raise SystemExit("python runtime verification failed")
PY
for x in ffmpeg ffprobe blender kdenlive audacity; do command -v "$x" >/dev/null || { echo "missing binary: $x"; exit 1; }; "$x" --version 2>&1 | head -n 1 || true; done
scenedetect version
blender --background --factory-startup --python-expr 'print("BLENDER_HEADLESS_SMOKE_OK")'
python - <<'PY'
import opentimelineio as otio, tempfile, pathlib
p=pathlib.Path(tempfile.mkdtemp())/"smoke.otio"
s=otio.schema.SerializableCollection(name="smoke", children=[otio.schema.Clip(name="smoke")])
otio.adapters.write_to_file(s,str(p)); otio.adapters.read_from_file(str(p)); print("OTIO_READ_WRITE_SMOKE_OK")
PY
python - <<'PY'
import json,datetime,pathlib
p=pathlib.Path("artifacts/engine-runtime/runtime-manifest.json")
p.write_text(json.dumps({"schemaVersion":"2.0.0","generatedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"modelsDownloaded":False,"corpusModified":False,"installed":["ffmpeg","ffprobe","blender","kdenlive","audacity","pyscenedetect","whisper","faster-whisper","whisperx","opentimelineio","docling","openvino","paddleocr-vl","qdrant-client","piper","kokoro"]},indent=2)+"\n")
PY
echo "[ENGINE] complete CPU runtime verification passed"