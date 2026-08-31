#!/usr/bin/env bash
set -euo pipefail

VIDEO_PATH="${1:-}"
PROMPT_FILE="${2:-tools/din-allah-media-engine/gpu-evaluation/prompt-suite.json}"
OUTPUT_DIR="${3:-./vbench-results}"

if [[ -z "${VIDEO_PATH}" || ! -f "${VIDEO_PATH}" ]]; then
  echo "Usage: $0 <video.mp4> [prompt-suite.json] [output-dir]" >&2
  exit 2
fi

mkdir -p "${OUTPUT_DIR}"

if [[ ! -d VBench-2.0 && ! -d VBench/VBench-2.0 ]]; then
  git clone --depth 1 https://github.com/Vchitect/VBench.git
fi

VBENCH_DIR="VBench-2.0"
if [[ ! -d "${VBENCH_DIR}" ]]; then
  VBENCH_DIR="VBench/VBench-2.0"
fi

python "${VBENCH_DIR}/evaluate.py" \
  --videos_path "$(dirname "${VIDEO_PATH}")" \
  --dimension Human_Anatomy Human_Identity Human_Clothes \
  --mode custom_input \
  --prompt_file "${PROMPT_FILE}" \
  --output_path "${OUTPUT_DIR}"

echo "VBench-2.0 evaluation complete: ${OUTPUT_DIR}"
