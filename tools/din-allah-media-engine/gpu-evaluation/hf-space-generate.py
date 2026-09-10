#!/usr/bin/env python3
"""Run a Wan2.2 Hugging Face Space and save the returned media outside Git.

This deliberately does not hard-code a Gradio endpoint contract. Spaces can change
UI endpoints, so the script inspects the public API first and requires the caller
to provide an explicit endpoint plus JSON-encoded arguments.

Required environment:
  HF_TOKEN       Hugging Face token (recommended for ZeroGPU quotas/authenticated use)
Optional environment:
  SPACE_ID       default: Slinkies86/Wan-AI-Wan2.2-TI2V-5B
  API_NAME       exact endpoint from `Client.view_api()`
  API_ARGS_JSON  JSON array matching the endpoint inputs
  OUT_DIR        default: ./din-allah-media-run/hf-space

Example:
  pip install --upgrade gradio_client
  python tools/din-allah-media-engine/gpu-evaluation/hf-space-generate.py

The first invocation without API_NAME prints the current endpoint contract and exits.
After choosing the endpoint, set API_NAME and API_ARGS_JSON and run again.
"""

from __future__ import annotations

import json
import os
import pathlib
import sys

from gradio_client import Client

SPACE_ID = os.environ.get("SPACE_ID", "Slinkies86/Wan-AI-Wan2.2-TI2V-5B")
API_NAME = os.environ.get("API_NAME")
OUT_DIR = pathlib.Path(os.environ.get("OUT_DIR", "./din-allah-media-run/hf-space"))


def main() -> int:
    token = os.environ.get("HF_TOKEN")
    client = Client(SPACE_ID, token=token)
    api = client.view_api(return_format="dict")

    if not API_NAME:
        print(json.dumps(api, ensure_ascii=False, indent=2))
        print(
            "\\nChoose an exact api_name and provide API_ARGS_JSON as a JSON array, "
            "then rerun."
        )
        return 0

    if API_NAME not in api:
        raise SystemExit(f"Unknown API_NAME={API_NAME!r}; inspect Client.view_api() output first.")

    raw_args = os.environ.get("API_ARGS_JSON")
    if raw_args is None:
        raise SystemExit("API_ARGS_JSON is required when API_NAME is set.")
    try:
        args = json.loads(raw_args)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"API_ARGS_JSON is not valid JSON: {exc}") from exc
    if not isinstance(args, list):
        raise SystemExit("API_ARGS_JSON must decode to a JSON array matching the endpoint inputs.")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    result = client.predict(*args, api_name=API_NAME)

    # Keep returned Gradio metadata as JSON and avoid copying heavyweight media into Git.
    (OUT_DIR / "space-result.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )
    (OUT_DIR / "space-run.json").write_text(
        json.dumps(
            {
                "spaceId": SPACE_ID,
                "apiName": API_NAME,
                "args": args,
                "hfTokenUsed": bool(token),
                "generatedMediaMustRemainOutsideGit": True,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Space result written to {OUT_DIR / 'space-result.json'}")
    print(f"Run metadata written to {OUT_DIR / 'space-run.json'}")
    print("Inspect the returned file path, then run ffprobe + SHA-256 + provenance validation.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
