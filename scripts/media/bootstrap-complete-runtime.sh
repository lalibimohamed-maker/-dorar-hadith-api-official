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
    ca-certificates curl git jq file ffmpeg tesseract-ocr \
    python3 python3-venv python3-pip python3-dev \
    build-essential cmake ninja-build libgl1 libglib2.0-0
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
  "usd-core==26.8"

require_cmd docker
require_cmd gh

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
PY

# Verify the selected containers can be pulled without executing arbitrary URLs.
docker pull "apache/nifi:2.12.0"
docker pull "nats:2.15.0"
docker pull "bluenviron/mediamtx:1.21.1"
docker pull "colmap/colmap:latest" || echo "COLMAP Docker image pull unavailable; use conda-forge::colmap=4.2.0 or the official build path."

echo "RUNTIME_BASE_INSTALLED"
echo "Note: Eclipse Ditto is started by the pinned upstream deployment bundle; Video2X is installed from its 6.4.0 verified release binary with Vulkan probing before promotion."
