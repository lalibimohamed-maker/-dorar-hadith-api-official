#!/usr/bin/env bash
set -euo pipefail

PROMPT_ID="${PROMPT_ID:-ant-macro-01}"
SEED="${SEED:-42}"
OUT_DIR="${OUT_DIR:-$PWD/din-allah-media-run/$PROMPT_ID-wan21-1.3b-mlx}"
MODEL_REPO="${MODEL_REPO:-Wan-AI/Wan2.1-T2V-1.3B}"
MODEL_DIR="${MODEL_DIR:-$PWD/Wan2.1-T2V-1.3B-MLX}"
UPSTREAM_DIR="${UPSTREAM_DIR:-$PWD/mlx-video}"
WIDTH="${WIDTH:-832}"
HEIGHT="${HEIGHT:-480}"
FRAMES="${FRAMES:-81}"
STEPS="${STEPS:-50}"
mkdir -p "$OUT_DIR"

python - <<'PY'
import json, os, pathlib, hashlib
suite = json.loads(pathlib.Path('tools/din-allah-media-engine/gpu-evaluation/prompt-suite.json').read_text())
wanted = os.environ.get('PROMPT_ID', 'ant-macro-01')
for clip in suite['clips']:
    if clip['id'] == wanted:
        prompt = clip['prompt']
        pathlib.Path('/tmp/din_allah_prompt.txt').write_text(prompt)
        pathlib.Path('/tmp/din_allah_prompt.sha256').write_text(hashlib.sha256(prompt.encode()).hexdigest())
        print(f'prompt_id={wanted}')
        print(f'prompt_sha256={hashlib.sha256(prompt.encode()).hexdigest()}')
        break
else:
    raise SystemExit(f'Unknown PROMPT_ID: {wanted}')
PY

if [ ! -d "$UPSTREAM_DIR/.git" ]; then
  git clone https://github.com/Blaizzy/mlx-video.git "$UPSTREAM_DIR"
fi

cd "$UPSTREAM_DIR"
git fetch --tags --force
UPSTREAM_REVISION="$(git rev-parse HEAD)"
UPSTREAM_DATE="$(git show -s --format=%cI HEAD)"
python -m pip install -U pip
python -m pip install -e .

if [ ! -d "$MODEL_DIR" ]; then
  python -m mlx_video.wan2.convert --checkpoint-dir "$(python - <<'PY'
from huggingface_hub import snapshot_download
print(snapshot_download('Wan-AI/Wan2.1-T2V-1.3B'))
PY
)" --output-dir "$MODEL_DIR"
fi

cd -
MODEL_REVISION="$(python - <<PY
from huggingface_hub import model_info
print(model_info('$MODEL_REPO').sha)
PY
)"

python -m mlx_video.wan2.generate \
  --model-dir "$MODEL_DIR" \
  --prompt "$(cat /tmp/din_allah_prompt.txt)" \
  --width "$WIDTH" \
  --height "$HEIGHT" \
  --num-frames "$FRAMES" \
  --steps "$STEPS" \
  --guide-scale 5.0 \
  --seed "$SEED" \
  --output-path "$OUT_DIR/${PROMPT_ID}.mp4"

ffprobe -v error \
  -show_entries format=duration,size:stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels \
  -of json \
  "$OUT_DIR/${PROMPT_ID}.mp4" > "$OUT_DIR/ffprobe.json"

sha256sum "$OUT_DIR/${PROMPT_ID}.mp4" > "$OUT_DIR/video.sha256"
printf '%s\n' "$(cat /tmp/din_allah_prompt.sha256)" > "$OUT_DIR/prompt.sha256"

cat > "$OUT_DIR/run-metadata.json" <<JSON
{
  "candidate": "wan2.1-t2v-1.3b-mlx",
  "modelRepo": "$MODEL_REPO",
  "modelRevision": "$MODEL_REVISION",
  "upstreamRepo": "https://github.com/Blaizzy/mlx-video",
  "upstreamRevision": "$UPSTREAM_REVISION",
  "upstreamRevisionDate": "$UPSTREAM_DATE",
  "promptId": "$PROMPT_ID",
  "promptSha256": "$(cat /tmp/din_allah_prompt.sha256)",
  "seed": $SEED,
  "width": $WIDTH,
  "height": $HEIGHT,
  "frames": $FRAMES,
  "steps": $STEPS,
  "licenseStatus": "checkpoint_terms_must_be_verified_before_publication",
  "generatedVideoRole": "illustration_only",
  "videoPath": "${PROMPT_ID}.mp4"
}
JSON

echo "Generated: $OUT_DIR/${PROMPT_ID}.mp4"
echo "Metadata:  $OUT_DIR/run-metadata.json"
echo "Probe:     $OUT_DIR/ffprobe.json"
echo "Hash:      $OUT_DIR/video.sha256"
