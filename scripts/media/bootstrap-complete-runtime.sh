#!/usr/bin/env bash
set -euo pipefail

# Reproducible Linux bootstrap for the Dinullah open media/runtime stack.
# It does not modify Corpus, source PDFs, rights metadata, or trusted content.
# It installs approved software only from explicitly selected package sources/releases.

: "${MEDIA_RUNTIME_INSTALL:=0}"
if [[ "${MEDIA_RUNTIME_INSTALL}" != "1" ]]; then
  echo "Dry-run. Set MEDIA_RUNTIME_INSTALL=1 in an explicit deployment environment."
  exit 0
fi

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "Missing command: $1" >&2; exit 1; }; }

if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y --no-install-recommends \
    ca-certificates curl git jq file ffmpeg tesseract-ocr imagemagick inkscape \
    mediainfo frei0r-plugins pipewire wireplumber \
    python3 python3-venv python3-pip python3-dev \
    build-essential cmake ninja-build libgl1 libglib2.0-0 nodejs npm libvulkan1 vulkan-tools
else
  echo "Unsupported host package manager. Use a deployment image matching the pinned runtime."
  exit 2
fi

RUNTIME_ROOT="${MEDIA_RUNTIME_ROOT:-/opt/dinullah-media-runtime}"
python3 -m venv "${RUNTIME_ROOT}/venv"
"${RUNTIME_ROOT}/venv/bin/python" -m pip install --upgrade pip setuptools wheel
"${RUNTIME_ROOT}/venv/bin/pip" install \
  "paddlepaddle==3.2.0" \
  "paddleocr==3.7.0" \
  "open3d==0.20.0" \
  "pycolmap==4.2.0" \
  "realesrgan==0.3.0" \
  "usd-core==26.8" \
  "opentimelineio==0.18.1" \
  "scenedetect-headless==0.7.1"

require_cmd docker
require_cmd gh
require_cmd node

echo "Base CLI versions:"
ffmpeg -version | head -n1
tesseract --version | head -n1
docker --version
gh --version | head -n1

echo "Python runtime versions:"
"${RUNTIME_ROOT}/venv/bin/python" - <<'PY'
import paddle, paddleocr, open3d, pycolmap, pxr, realesrgan
print("PaddlePaddle", paddle.__version__)
print("PaddleOCR", getattr(paddleocr, "__version__", "installed"))
print("Open3D", open3d.__version__)
print("PyCOLMAP", pycolmap.__version__)
print("USD/PXR import", "OK")
print("Real-ESRGAN import", "OK")
import scenedetect
print("PySceneDetect", getattr(scenedetect, "__version__", "installed"))
PY

# Verify the selected containers can be pulled without executing arbitrary URLs.
docker pull "apache/nifi:2.12.0"
docker pull "nats:2.15.0"
docker pull "bluenviron/mediamtx:1.21.1"
docker pull "ghcr.io/k4yt3x/video2x:6.4.0@sha256:e21b6893269b4cb6f5603802726fd7537be241f6b39217b73530478861acbca1"
node -e 'const v=require("gltf-validator"); console.log("GLTF_VALIDATOR_OK", v.version)'
echo "COLMAP: build from official upstream tag 4.2.0 via runtime/colmap/Dockerfile"

if ffmpeg -hide_banner -filters 2>/dev/null | grep -q "libvmaf"; then
  echo "VMAF_FFMPEG_FILTER_OK"
else
  echo "VMAF_FFMPEG_FILTER_UNAVAILABLE"
fi
"${RUNTIME_ROOT}/venv/bin/scenedetect" version

echo "RUNTIME_BASE_INSTALLED"
echo "Note: Eclipse Ditto is started by the pinned upstream deployment bundle; Video2X is provided by the official 6.4.0 GHCR image and requires GPU/Vulkan capability for acceleration."
echo "Studio desktop applications are cached in the Din Allah Media Studio release and installed separately from this headless runtime."
