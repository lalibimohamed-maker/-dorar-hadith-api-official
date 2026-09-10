#!/usr/bin/env bash
set -euo pipefail

MIN_VRAM_GB="${MIN_VRAM_GB:-24}"

if ! command -v nvidia-smi >/dev/null 2>&1; then
  echo "BLOCKED: NVIDIA GPU runtime not detected (nvidia-smi missing)." >&2
  exit 2
fi

TOTAL_VRAM_MB="$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | awk '{sum += $1} END {print sum+0}')"
GPU_COUNT="$(nvidia-smi --query-gpu=name --format=csv,noheader | wc -l | tr -d ' ')"

if [[ -z "$TOTAL_VRAM_MB" || "$TOTAL_VRAM_MB" -le 0 ]]; then
  echo "BLOCKED: unable to read NVIDIA VRAM." >&2
  exit 3
fi

MIN_VRAM_MB="$(awk -v gb="$MIN_VRAM_GB" 'BEGIN { printf "%d", gb * 1024 }')"

cat <<JSON
{
  "gpuCount": $GPU_COUNT,
  "totalVramGb": $(awk -v mb="$TOTAL_VRAM_MB" 'BEGIN { printf "%.2f", mb / 1024 }'),
  "minimumVramGb": $MIN_VRAM_GB,
  "status": "$(if (( TOTAL_VRAM_MB >= MIN_VRAM_MB )); then echo ready; else echo blocked; fi)"
}
JSON

if (( TOTAL_VRAM_MB < MIN_VRAM_MB )); then
  echo "BLOCKED: Wan2.2 TI2V-5B first-run profile requires at least ${MIN_VRAM_GB} GiB aggregate VRAM for the documented single-GPU path." >&2
  exit 4
fi

nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader > gpu-inventory.csv
printf 'GPU preflight passed. Inventory written to gpu-inventory.csv\n'
