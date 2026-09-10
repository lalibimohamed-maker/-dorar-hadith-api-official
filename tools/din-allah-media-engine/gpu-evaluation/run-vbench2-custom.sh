#!/usr/bin/env bash
set -euo pipefail

VIDEO_PATH="${1:-}"
DIMENSION="${2:-}"
PROMPT_FILE="${3:-}"
OUTPUT_DIR="${4:-./vbench2-results}"

if [[ -z "$VIDEO_PATH" || ! -f "$VIDEO_PATH" ]]; then
  echo "Usage: $0 <video.mp4> <VBench-2.0-dimension> <prompt-file.json> [output-dir]" >&2
  exit 2
fi

if [[ -z "$DIMENSION" || -z "$PROMPT_FILE" || ! -f "$PROMPT_FILE" ]]; then
  echo "A supported VBench-2.0 dimension and an existing custom prompt mapping are required." >&2
  exit 2
fi

case "$DIMENSION" in
  Human_Anatomy|Human_Identity|Human_Clothes|Diversity|Multi-View_Consistency) ;;
  *)
    echo "Unsupported VBench-2.0 custom-input dimension: $DIMENSION" >&2
    exit 2
    ;;
esac

mkdir -p "$OUTPUT_DIR"

if [[ ! -d VBench ]]; then
  git clone --depth 1 https://github.com/Vchitect/VBench.git
fi

python VBench/VBench-2.0/vbench2/launch/evaluate.py \
  --videos_path "$(dirname "$VIDEO_PATH")" \
  --dimension "$DIMENSION" \
  --mode custom_input \
  --prompt_file "$PROMPT_FILE" \
  --output_path "$OUTPUT_DIR"

echo "VBench-2.0 evaluation complete: ${OUTPUT_DIR}"
