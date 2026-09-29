#!/usr/bin/env bash
set -euo pipefail

: "${DINULLAH_WEIGHT_RELEASE:=dinullah-media-weights-v2026.09.29}"
: "${DINULLAH_RUNTIME_WEIGHTS_DIR:=runtime-data/weights}"
: "${GITHUB_REPOSITORY:=lalibimohamed-maker/-dorar-hadith-api-official}"

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "Missing command: $1" >&2; exit 1; }; }
require_cmd curl
require_cmd sha256sum

mkdir -p "$DINULLAH_RUNTIME_WEIGHTS_DIR"

python3 - <<'PY'
import json
from pathlib import Path
d=json.load(open("config/media-weight-release-manifest-2026.json",encoding="utf-8"))
assert d["releaseModel"]["storage"]=="github-release-assets"
assert d["releaseModel"]["notStoredInGit"] is True
print("WEIGHT_RELEASE_POLICY_OK")
PY

# Runtime consumes only release assets from the encyclopedia's own release cache.
# Never fall back to an upstream URL here: acquisition is separated from runtime use.
assets=(
  "RealESRGAN_x4plus.pth"
  "RealESRGAN_x2plus.pth"
  "realesr-general-x4v3.pth"
  "realesr-general-wdn-x4v3.pth"
  "PP-OCRv5_mobile_det_infer.tar"
  "arabic_PP-OCRv5_mobile_rec_infer.tar"
)

for asset in "${assets[@]}"; do
  url="https://github.com/${GITHUB_REPOSITORY}/releases/download/${DINULLAH_WEIGHT_RELEASE}/${asset}"
  echo "[WEIGHT START] $asset"
  curl --fail --location --retry 3 --proto '=https' --tlsv1.2 -o "$DINULLAH_RUNTIME_WEIGHTS_DIR/$asset" "$url"
  test -s "$DINULLAH_RUNTIME_WEIGHTS_DIR/$asset"
  sha256sum "$DINULLAH_RUNTIME_WEIGHTS_DIR/$asset"
  echo "[WEIGHT DONE] $asset"
done

echo "WEIGHT_RUNTIME_READY"
