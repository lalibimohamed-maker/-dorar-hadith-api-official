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
require_cmd git

mkdir -p "$DINULLAH_AI_RUNTIME_ROOT"
release_base="https://github.com/$GITHUB_REPOSITORY/releases/download/$DINULLAH_AI_RUNTIME_RELEASE"

echo "[AI RUNTIME] fetching release manifests"
curl --fail --location --retry 3 --proto '=https' --tlsv1.2 -o "$DINULLAH_AI_RUNTIME_ROOT/ai-runtime-lock.txt" "$release_base/ai-runtime-lock.txt"
echo "[AI RUNTIME] installing from release cache only"

python3 -m venv "$DINULLAH_AI_RUNTIME_ROOT/venv"
"$DINULLAH_AI_RUNTIME_ROOT/venv/bin/pip" install --no-index --find-links "$DINULLAH_AI_RUNTIME_ROOT/packages"   "torch==2.14.0" "transformers==5.17.0" "diffusers==0.40.0" "accelerate==1.15.0" "safetensors==0.8.0" || {
  echo "[AI RUNTIME] package cache missing; release must be populated before installation." >&2
  exit 2
}

echo "[AI RUNTIME] Python packages installed"
