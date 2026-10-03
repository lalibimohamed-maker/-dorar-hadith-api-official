#!/usr/bin/env bash
set -euo pipefail

VIDEO_PATH="${1:-}"
OUTPUT_DIR="${2:-./vbench-results}"
VBENCH_DIR="${VBENCH_DIR:-./VBench}"

if [[ -z "$VIDEO_PATH" || ! -f "$VIDEO_PATH" ]]; then
  echo "Usage: $0 <video-or-folder> [output-dir]" >&2
  exit 2
fi

mkdir -p "$OUTPUT_DIR"

if [[ ! -d "$VBENCH_DIR/.git" ]]; then
  git clone --depth 1 https://github.com/Vchitect/VBench.git "$VBENCH_DIR"
fi

PROMPT_FILE="$PWD/tools/din-allah-media-engine/gpu-evaluation/vbench-custom-prompt.json"
VIDEOS_DIR="$(dirname "$VIDEO_PATH")"
if [[ -d "$VIDEO_PATH" ]]; then
  VIDEOS_DIR="$VIDEO_PATH"
fi

python "$VBENCH_DIR/evaluate.py" \
  --videos_path "$VIDEOS_DIR" \
  --dimension subject_consistency background_consistency motion_smoothness dynamic_degree aesthetic_quality imaging_quality \
  --mode custom_input \
  --prompt_file "$PROMPT_FILE" \
  --output_path "$OUTPUT_DIR"

printf '%s\n' "VBench custom evaluation complete: $OUTPUT_DIR"
