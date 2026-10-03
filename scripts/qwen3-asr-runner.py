#!/usr/bin/env python3
"""Local-first Qwen3-ASR JSON-lines runner.

Reads one JSON object per line:
{"model": "...", "audio": "...", "language": null}

Writes:
{"ok": true, "language": "...", "text": "..."}
or {"ok": false, "error": "..."}
"""
import json
import sys
from pathlib import Path

import torch
from qwen_asr import Qwen3ASRModel


def load_model(model_path: str):
    return Qwen3ASRModel.from_pretrained(
        model_path,
        dtype=torch.float32 if not torch.cuda.is_available() else torch.bfloat16,
        device_map="auto" if torch.cuda.is_available() else "cpu",
        max_inference_batch_size=1,
        max_new_tokens=256,
        local_files_only=True,
    )


def main():
    cache = {}
    for raw in sys.stdin:
        raw = raw.strip()
        if not raw:
            continue
        try:
            req = json.loads(raw)
            model_path = str(Path(req["model"]).expanduser())
            audio = str(Path(req["audio"]).expanduser())
            language = req.get("language")
            if model_path not in cache:
                cache[model_path] = load_model(model_path)
            result = cache[model_path].transcribe(
                audio=audio,
                language=language,
                return_time_stamps=False,
            )[0]
            print(json.dumps({
                "ok": True,
                "language": result.language,
                "text": result.text,
            }, ensure_ascii=False), flush=True)
        except Exception as exc:
            print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
