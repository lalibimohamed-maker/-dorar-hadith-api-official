# Run this script inside a clean Kaggle/Colab GPU runtime.
# It intentionally keeps model weights and generated video outside the Git repository.
set -euo pipefail

PROMPT_ID="${PROMPT_ID:-ant-macro-01}"
SEED="${SEED:-42}"
OUT_DIR="${OUT_DIR:-$PWD/din-allah-media-run/$PROMPT_ID}"
MODEL_DIR="${MODEL_DIR:-$PWD/Wan2.2-TI2V-5B}"
UPSTREAM_DIR="${UPSTREAM_DIR:-$PWD/Wan2.2}"

mkdir -p "$OUT_DIR"

python - <<'PY'
import json, os, pathlib
suite = json.loads(pathlib.Path('tools/din-allah-media-engine/gpu-evaluation/prompt-suite.json').read_text())
wanted = os.environ.get('PROMPT_ID', 'ant-macro-01')
for clip in suite['clips']:
    if clip['id'] == wanted:
        pathlib.Path('/tmp/din_allah_prompt.txt').write_text(clip['prompt'])
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
git fetch --tags --force
UPSTREAM_REVISION="$(git rev-parse HEAD)"
UPSTREAM_DATE="$(git show -s --format=%cI HEAD)"

python -m pip install -r requirements.txt
python -m pip install "huggingface_hub[cli]"

if [ ! -d "$MODEL_DIR" ]; then
  huggingface-cli download Wan-AI/Wan2.2-TI2V-5B --local-dir "$MODEL_DIR"
fi

MODEL_REVISION="$(python - <<PY
from huggingface_hub import model_info
print(model_info('Wan-AI/Wan2.2-TI2V-5B').sha)
PY
)"

MODEL_FILE_HASHES="$(find "$MODEL_DIR" -type f -print0 | sort -z | xargs -0 sha256sum)"
printf '%s\n' "$MODEL_FILE_HASHES" > "$OUT_DIR/model-file-sha256.txt"

python generate.py \
  --task ti2v-5B \
  --size 1280*704 \
  --ckpt_dir "$MODEL_DIR" \
  --offload_model True \
  --convert_model_dtype \
  --t5_cpu \
  --seed "$SEED" \
  --prompt "$(cat /tmp/din_allah_prompt.txt)"

VIDEO_CANDIDATE="$(find "$UPSTREAM_DIR" -maxdepth 2 -type f \( -name '*.mp4' -o -name '*.webm' \) -printf '%T@ %p\n' | sort -nr | head -n1 | cut -d' ' -f2-)"

test -n "$VIDEO_CANDIDATE"

cp "$VIDEO_CANDIDATE" "$OUT_DIR/${PROMPT_ID}.mp4"

ffprobe -v error \
  -show_entries format=duration,size:stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels \
  -of json \
  "$OUT_DIR/${PROMPT_ID}.mp4" > "$OUT_DIR/ffprobe.json"

sha256sum "$OUT_DIR/${PROMPT_ID}.mp4" > "$OUT_DIR/video.sha256"

cat > "$OUT_DIR/run-metadata.json" <<JSON
{
  "promptId": "$PROMPT_ID",
  "seed": $SEED,
  "upstreamRepo": "https://github.com/Wan-Video/Wan2.2",
  "upstreamRevision": "$UPSTREAM_REVISION",
  "upstreamRevisionDate": "$UPSTREAM_DATE",
  "modelRepo": "https://huggingface.co/Wan-AI/Wan2.2-TI2V-5B",
  "modelRevision": "$MODEL_REVISION",
  "generationCommand": "python generate.py --task ti2v-5B --size 1280*704 --offload_model True --convert_model_dtype --t5_cpu",
  "rightsStatus": "verify_exact_checkpoint_before_publication",
  "videoPath": "${PROMPT_ID}.mp4"
}
JSON

echo "Generated: $OUT_DIR/${PROMPT_ID}.mp4"
echo "Metadata:  $OUT_DIR/run-metadata.json"
echo "Probe:     $OUT_DIR/ffprobe.json"
echo "Hash:      $OUT_DIR/video.sha256"
echo "Model hashes: $OUT_DIR/model-file-sha256.txt"
