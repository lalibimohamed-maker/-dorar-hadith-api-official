# Rechercher Ω — Multimodal Model Fleet

Rechercher Ω now treats media generation as a first-class execution capability,
not as a side feature.

## Capability lanes

- Reasoning: Qwen3
- Vision/multimodal reasoning: Qwen3-VL (4B verified registry candidate; runtime-only due size)
- OCR/document understanding: PaddleOCR-VL
- Video: HunyuanVideo-1.5, LTX-2, CogVideoX (2B staged for Kaggle/runtime), Wan 2.2
- Audio/video: LTX-2
- Speech synthesis: CosyVoice (CosyVoice2-0.5B staged as a verified starter candidate)
- Speech recognition: Whisper (Whisper tiny starter acquired; larger variants remain runtime/Kaggle candidates)
- Image generation/editing: Flux

The fleet is a registry and router, not an automatic weight distributor. Every
model remains blocked from promotion until its exact revision, SHA-256 and
applicable weight/model license are reviewed.

HunyuanVideo-1.5 officially supports text-to-video and image-to-video, and its
current repository also documents consumer-GPU-oriented execution. LTX-2
provides synchronized audio/video generation and text/image/video generation
paths. CogVideoX provides text/image-to-video generation. These capabilities
are represented in the fleet without pretending that model weights are already
installed.

## Execution strategy

1. Prefer local execution when the model is installed and verified.
2. Use Kaggle GPU as a remote free execution lane when available.
3. Use Hugging Face inference only where an explicitly available/free quota is
   present.
4. Never silently invoke paid APIs.
5. Never write generated media directly to Corpus.
6. Generated media requires provenance and a rights gate before publication.

## Media pipeline

Research → script → storyboard → assets → generation/editing → voice → subtitles
→ composition → provenance/rights → Council → publication.

The generated video is an explanatory artifact. The underlying source records
remain the evidence layer.


## Starter-engine status
The lightweight acquisition lane now includes Qwen3-0.6B, PaddleOCR-VL and Whisper tiny. Larger or specially licensed families remain registered for runtime/Kaggle execution and are not automatically copied into GitHub artifacts.


## Persistent distribution

Lightweight verified starter weights are distributed through the GitHub Release
`rechercher-omega-engines-v0.1.0`, not through Git history or recurring
Actions artifacts. The current release set is Qwen3-0.6B, PaddleOCR-VL and
Whisper tiny. The four-hour verification workflow checks the release assets
without downloading them again. GitHub Releases permit individual assets under
2 GiB and do not impose a total release size cap.