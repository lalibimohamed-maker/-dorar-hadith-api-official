#!/usr/bin/env bash
set -euo pipefail

# First real GPU run: Wan2.2 TI2V-5B, one deterministic prompt.
# Run only in an external GPU runtime (Kaggle/Colab/local GPU), never in PR CI.

PROMPT_ID="${PROMPT_ID:-ant-macro-01}"
SEED="${SEED:-42}"
FRAME_NUM="${FRAME_NUM:-121}" # 121 frames at 24 FPS ~= 5.04 seconds; official code requires 4n+1.
MIN_VRAM_GB="${MIN_VRAM_GB:-24}"
MIN_FREE_DISK_GB="${MIN_FREE_DISK_GB:-45}"
OUT_DIR="${OUT_DIR:-$PWD/din-allah-media-run/$PROMPT_ID}"
MODEL_DIR="${MODEL_DIR:-$PWD/Wan2.2-TI2V-5B}"
UPSTREAM_DIR="${UPSTREAM_DIR:-$PWD/Wan2.2}"
WAN_REVISION="${WAN_REVISION:-main}"
MODEL_REVISION="${MODEL_REVISION:-main}"

command -v nvidia-smi >/dev/null 2>&1 || { echo "BLOCKED: NVIDIA GPU runtime not detected." >&2; exit 2; }
command -v ffprobe >/dev/null 2>&1 || { echo "BLOCKED: ffprobe is required." >&2; exit 2; }
command -v python >/dev/null 2>&1 || { echo "BLOCKED: Python is required." >&2; exit 2; }

# The official single-GPU TI2V-5B path calls for >=24 GB VRAM.
MAX_GPU_VRAM_MB="$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | sort -nr | head -n1 | tr -d ' ')"
if [[ -z "$MAX_GPU_VRAM_MB" ]] || (( MAX_GPU_VRAM_MB < MIN_VRAM_GB * 1024 )); then
  echo "BLOCKED: largest GPU has ${MAX_GPU_VRAM_MB:-0} MiB; need >= ${MIN_VRAM_GB} GiB for the documented single-GPU profile." >&2
  exit 4
fi

FREE_DISK_KB="$(df -Pk "$PWD" | awk 'NR==2 {print $4}')"
if (( FREE_DISK_KB < MIN_FREE_DISK_GB * 1024 * 1024 )); then
  echo "BLOCKED: insufficient free disk space; need >= ${MIN_FREE_DISK_GB} GiB before model download." >&2
  exit 5
fi

mkdir -p "$OUT_DIR"

python - <<'PY'
import hashlib, json, os, pathlib
suite = json.loads(pathlib.Path('tools/din-allah-media-engine/gpu-evaluation/prompt-suite.json').read_text())
wanted = os.environ.get('PROMPT_ID', 'ant-macro-01')
for clip in suite['clips']:
    if clip['id'] == wanted:
        prompt = clip['prompt']
        pathlib.Path('/tmp/din_allah_prompt.txt').write_text(prompt, encoding='utf-8')
        pathlib.Path('/tmp/din_allah_prompt.sha256').write_text(
            hashlib.sha256(prompt.encode('utf-8')).hexdigest() + '\n', encoding='utf-8')
        print(f"prompt_id={clip['id']}")
        print(f"duration_seconds={clip['durationSeconds']}")
        print(f"aspect_ratio={clip['aspectRatio']}")
        break
else:
    raise SystemExit(f'Unknown PROMPT_ID: {wanted}')
PY

if [ ! -d "$UPSTREAM_DIR/.git" ]; then
  git clone https://github.com/Wan-Video/Wan2.2.git "$UPSTREAM_DIR"
fi

cd "$UPSTREAM_DIR"
git fetch --tags --force origin "$WAN_REVISION" || git fetch --tags --force
if git rev-parse --verify --quiet "$WAN_REVISION" >/dev/null 2>&1; then
  git checkout --detach "$WAN_REVISION"
else
  git checkout --detach "origin/$WAN_REVISION"
fi
UPSTREAM_REVISION="$(git rev-parse HEAD)"
UPSTREAM_DATE="$(git show -s --format=%cI HEAD)"

python -m pip install -r requirements.txt
python -m pip install "huggingface_hub[cli]"

if [ ! -d "$MODEL_DIR" ]; then
  huggingface-cli download Wan-AI/Wan2.2-TI2V-5B --revision "$MODEL_REVISION" --local-dir "$MODEL_DIR"
fi

MODEL_REVISION_RESOLVED="$(python - <<PY
from huggingface_hub import model_info
print(model_info('Wan-AI/Wan2.2-TI2V-5B', revision='${MODEL_REVISION}').sha)
PY
)"

find "$MODEL_DIR" -type f -print0 | sort -z | xargs -0 sha256sum > "$OUT_DIR/model-file-sha256.txt"

cd "$UPSTREAM_DIR"
python generate.py \
  --task ti2v-5B \
  --size 1280*704 \
  --frame_num "$FRAME_NUM" \
  --ckpt_dir "$MODEL_DIR" \
  --offload_model True \
  --convert_model_dtype \
  --t5_cpu \
  --base_seed "$SEED" \
  --prompt "$(cat /tmp/din_allah_prompt.txt)"

VIDEO_CANDIDATE="$(find "$UPSTREAM_DIR" -maxdepth 2 -type f \( -name '*.mp4' -o -name '*.webm' \) -printf '%T@ %p\n' | sort -nr | head -n1 | cut -d' ' -f2-)"
test -n "$VIDEO_CANDIDATE"

cp "$VIDEO_CANDIDATE" "$OUT_DIR/${PROMPT_ID}.mp4"
ffprobe -v error -show_entries format=duration,size:stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels -of json "$OUT_DIR/${PROMPT_ID}.mp4" > "$OUT_DIR/ffprobe.json"
sha256sum "$OUT_DIR/${PROMPT_ID}.mp4" > "$OUT_DIR/video.sha256"

GPU_NAME="$(nvidia-smi --query-gpu=name --format=csv,noheader | head -n1)"
GPU_DRIVER="$(nvidia-smi --query-gpu=driver_version --format=csv,noheader | head -n1)"
PROMPT_SHA="$(cat /tmp/din_allah_prompt.sha256)"

cat > "$OUT_DIR/run-metadata.json" <<JSON
{
  "promptId": "$PROMPT_ID",
  "promptSha256": "$PROMPT_SHA",
  "seed": $SEED,
  "frameNum": $FRAME_NUM,
  "upstreamRepo": "https://github.com/Wan-Video/Wan2.2",
  "upstreamRevision": "$UPSTREAM_REVISION",
  "upstreamRevisionDate": "$UPSTREAM_DATE",
  "modelRepo": "https://huggingface.co/Wan-AI/Wan2.2-TI2V-5B",
  "modelRevision": "$MODEL_REVISION_RESOLVED",
  "gpu": "$GPU_NAME",
  "driver": "$GPU_DRIVER",
  "resolution": "1280x704",
  "generationCommand": "python generate.py --task ti2v-5B --size 1280*704 --frame_num $FRAME_NUM --offload_model True --convert_model_dtype --t5_cpu --base_seed $SEED",
  "rightsStatus": "verify_exact_checkpoint_terms_before_publication",
  "generatedVideoIsEvidence": false,
  "videoPath": "${PROMPT_ID}.mp4"
}
JSON

echo "Generated: $OUT_DIR/${PROMPT_ID}.mp4"
echo "Metadata:  $OUT_DIR/run-metadata.json"
echo "Probe:     $OUT_DIR/ffprobe.json"
echo "Hash:      $OUT_DIR/video.sha256"
echo "Model hashes: $OUT_DIR/model-file-sha256.txt"
