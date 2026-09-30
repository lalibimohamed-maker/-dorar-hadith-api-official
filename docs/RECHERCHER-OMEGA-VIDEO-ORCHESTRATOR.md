# Rechercher Omega - Video Orchestrator

The Video Studio now resolves each scene to a concrete model/runtime plan.

- Evidence IDs remain attached to every scene.
- Cleared model weights are required by default.
- Uncleared models are queued, never silently executed.
- Free GPU paths can resolve to Kaggle or local ComfyUI.
- FFmpeg composition is deterministic and Corpus-safe.
- The orchestrator performs no network execution itself.

A real generation run still requires an explicitly configured runtime and cleared model/weight licenses.
