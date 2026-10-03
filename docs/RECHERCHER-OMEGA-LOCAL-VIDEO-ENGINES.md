# Rechercher Ω — Local Video Engines

HunyuanVideo-1.5 and LTX-2 are retained as local/self-hostable video workers, not as paid API dependencies.

## Operating model

The engine weights live in the private repository:

- `lalibimohamed-maker/rechercher-omega-engine-storage`
- Hunyuan Release: `rechercher-omega-hunyuanvideo15-v1.0.0`
- LTX Release: `rechercher-omega-ltx2-v1.0.0`

A private Release containing real weights is evidence of **asset presence**, not proof that the complete runtime is executable.

For this reason Ω tracks five independent gates:

1. license/redistribution clearance
2. exact revision or immutable storage manifest
3. SHA-256 verification
4. runtime/dependency verification
5. end-to-end generation smoke test

Until all five pass, the router queues the engine and never executes it.

## Token semantics

Local model execution has no per-video API-token quota. The actual limits are compute resources such as GPU memory, host memory, storage, and generation time.

That does **not** mean infinite generation. A GPU runner still has finite capacity, and every generated video consumes compute and storage.

## HunyuanVideo-1.5

The upstream project documents Linux + CUDA execution and a minimum of 14 GB GPU memory when model offloading is enabled. Its step-distilled 480p I2V path can reduce inference work substantially. See the upstream repository for the exact release-specific requirements.

The Ω copy currently contains a packaged runtime bundle and readiness metadata, but the project remains dependency-blocked and has not been declared end-to-end verified.

## LTX-2

The upstream LTX project exposes production inference pipelines for text/image-to-video and related transformations. The exact required checkpoint components and matching text encoder are checkpoint-dependent and must be verified against the pinned stored assets before execution.

The Ω copy currently contains the stored model assets and license material, but end-to-end runtime verification has not been declared.

## Boundaries

Generated videos never become scholarly evidence and never write directly into the scholarly Corpus.

Review-only storage is intentionally private. No workflow may silently copy these assets into public Releases before the applicable license gate is cleared.

## Verification workflow

Use:

`.github/workflows/rechercher-omega-video-runtime-verification.yml`

The storage verification job reads Release metadata only and does not download hundreds of gigabytes onto an ordinary GitHub runner.

The optional GPU smoke job requires an authorized self-hosted Linux/CUDA runner with the model assets already staged locally. It never downloads the model and never accepts an arbitrary shell command.


## LTX-2 pinned checkpoint

Ω pins LTX-2 to Hugging Face revision `dfcc2108383fe1aaa0584bdf55d368a4bdadd90c`. The pinned model card identifies LTX-2 as a local-execution audio-video foundation model and lists the checkpoint components used by the runtime, including the embedded `text_encoder`. The pinned documentation also exposes an 8-step distilled checkpoint and a two-stage generation path. citeturn249611view0

The Ω smoke harness therefore checks the actual checkpoint directory layout instead of assuming the later LTX-2.5 directory names.
