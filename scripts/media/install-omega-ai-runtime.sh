#!/usr/bin/env bash
set -euo pipefail

: "${DINULLAH_AI_RUNTIME_RELEASE:=dinullah-omega-ai-runtime-v2026.09.29}"
: "${DINULLAH_AI_RUNTIME_ROOT:=/opt/dinullah-omega-ai-runtime}"
: "${GITHUB_REPOSITORY:=lalibimohamed-maker/-dorar-hadith-api-official}"

require_cmd(){ command -v "$1" >/dev/null 2>&1 || { echo "Missing command: $1" >&2; exit 1; }; }
require_cmd curl
require_cmd sha256sum
require_cmd python3
require_cmd tar

mkdir -p "$DINULLAH_AI_RUNTIME_ROOT/packages" "$DINULLAH_AI_RUNTIME_ROOT/comfyui"
base="https://github.com/$GITHUB_REPOSITORY/releases/download/$DINULLAH_AI_RUNTIME_RELEASE"

echo "[AI RUNTIME] release=$DINULLAH_AI_RUNTIME_RELEASE"

curl --fail --location --retry 3 --proto '=https' --tlsv1.2 -o "$DINULLAH_AI_RUNTIME_ROOT/ai-runtime-sha256.txt" "$base/ai-runtime-sha256.txt"

while read -r sum relpath; do
  [[ "$sum" =~ ^[0-9a-fA-F]{64}$ ]] || continue
  name="$(basename "$relpath")"
  case "$relpath" in
    release-assets/packages/*) out="$DINULLAH_AI_RUNTIME_ROOT/packages/$name" ;;
    release-assets/comfyui/*) out="$DINULLAH_AI_RUNTIME_ROOT/comfyui/$name" ;;
    *) continue ;;
  esac
  echo "[AI ASSET START] $name"
  curl --fail --location --retry 3 --proto '=https' --tlsv1.2 -o "$out" "$base/$name"
  echo "$sum  $out" | sha256sum -c -
  echo "[AI ASSET DONE] $name"
done < "$DINULLAH_AI_RUNTIME_ROOT/ai-runtime-sha256.txt"

if [[ ! -s "$DINULLAH_AI_RUNTIME_ROOT/comfyui/ComfyUI-0.37.0.tar.gz" ]]; then
  echo "[AI RUNTIME] ComfyUI release asset is missing." >&2
  exit 2
fi

tar -xzf "$DINULLAH_AI_RUNTIME_ROOT/comfyui/ComfyUI-0.37.0.tar.gz" -C "$DINULLAH_AI_RUNTIME_ROOT/comfyui"
mkdir -p "$DINULLAH_AI_RUNTIME_ROOT/venv"
python3 -m venv "$DINULLAH_AI_RUNTIME_ROOT/venv"
"$DINULLAH_AI_RUNTIME_ROOT/venv/bin/python" -m pip install --upgrade pip
"$DINULLAH_AI_RUNTIME_ROOT/venv/bin/pip" install --no-index --find-links "$DINULLAH_AI_RUNTIME_ROOT/packages"   "torch==2.14.0" "transformers==5.17.0" "diffusers==0.40.0" "accelerate==1.15.0" "safetensors==0.8.0" "kokoro==0.9.4"

echo "[AI RUNTIME] Python runtime installed from release cache."
echo "[AI RUNTIME] ComfyUI source unpacked under $DINULLAH_AI_RUNTIME_ROOT/comfyui"
