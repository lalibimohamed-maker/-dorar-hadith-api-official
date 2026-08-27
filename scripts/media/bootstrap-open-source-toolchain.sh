#!/usr/bin/env bash
set -euo pipefail

# Governed deployment bootstrap. It installs only from the host's configured
# package indexes. It never executes an arbitrary URL, downloads model weights,
# or modifies trusted Corpus content.

: "${MEDIA_TOOLCHAIN_INSTALL:=0}"
if [[ "$MEDIA_TOOLCHAIN_INSTALL" != "1" ]]; then
  echo "Dry-run: set MEDIA_TOOLCHAIN_INSTALL=1 in an explicit deployment to install packages."
  exit 0
fi

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 1; }
}

if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y --no-install-recommends ffmpeg tesseract-ocr
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y ffmpeg tesseract
elif command -v apk >/dev/null 2>&1; then
  apk add --no-cache ffmpeg tesseract-ocr
else
  echo "No supported system package manager found; install approved packages through the deployment image/toolchain." >&2
  exit 2
fi

require_cmd ffmpeg
require_cmd tesseract

# Python OCR/vision packages are deliberately optional and are not installed
# automatically here because accelerator/runtime/model requirements vary.
# Real-ESRGAN, Video2X, COLMAP and Open3D should be installed through a pinned,
# reviewed deployment image once the target hardware/runtime is known.

ffmpeg -version | head -n 1
tesseract --version | head -n 1

echo "Approved base media toolchain installed. Run security scans and record versions/licenses before promotion."
