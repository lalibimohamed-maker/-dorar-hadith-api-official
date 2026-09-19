# Image Resolution Orchestrator — 2026

The encyclopedia uses a cooperative, adaptive pipeline rather than running every super-resolution model on every image.

## Cooperative design

1. Inspect dimensions, blur, compression, noise, text density, edges, faces, source provenance, available GPU, and memory.
2. Select one primary engine.
3. Use tiled inference when memory or image size requires it.
4. Run a second engine only when the quality gate identifies a documented need.
5. Compare output against source-derived diagnostics before publication.
6. Generate delivery and archival variants separately.
7. Record model, version, scale, runtime, resources, hashes, and provenance.

## Engine roles

- Thera: arbitrary-scale primary candidate.
- EQSR: arbitrary-scale cross-check candidate.
- UltraSR: arbitrary-scale research candidate.
- Real-ESRGAN: practical restoration path.
- SwinIR: restoration/quality path.
- HAT: high-quality validation candidate.

Public repositories document arbitrary-scale or output-scale controls in several of these projects, while fixed-scale models remain useful for restoration. Arbitrary output dimensions therefore do not imply native detail at the requested output size.

## 8K / 12K / 16K / 24K policy

8K, 12K, 16K, and 24K are supported as **target output resolutions** when the source, selected model, memory budget, and quality gate justify them. They are not claims that the input contained that many recoverable native details.

For archival material, the UI must show:

- original source dimensions;
- target dimensions;
- scale factor;
- whether detail is source-derived or model-inferred;
- model and model version;
- processing path;
- provenance/hash.

## Performance policy

- Never run every model by default.
- Lazy-load large model weights.
- Use device-aware routing.
- Prefer one-pass processing when quality permits.
- Fall back to CPU or classical resize when GPU/model execution is unavailable.
- Use tile overlap/seam checks for large images.
- Keep 24K+ out of default mobile processing.

## Rights and provenance

Model code, checkpoints, source images, and output assets have separate rights. A permissive code license does not automatically license a model checkpoint, dataset, or source media. Production use requires a verified rights status for each relevant asset.

## Truthfulness

No generated detail may be presented as an original photographic, manuscript, scientific, or historical detail. For Quranic manuscripts, scans, scientific figures, and other evidentiary media, the original and enhanced versions remain separately accessible.
