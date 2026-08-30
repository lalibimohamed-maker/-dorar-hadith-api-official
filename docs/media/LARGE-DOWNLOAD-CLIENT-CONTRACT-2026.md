# Large Media Download Client Contract — 2026

The encyclopedia's browser and mobile clients must be able to download authorized large Islamic media without an artificial application-level file-size ceiling.

- The application-level maximum file size is intentionally unset (`null`): **no application-imposed size limit**.
- A large-file size such as 20 GB is a regression-test case, not a maximum; the policy does not establish a 20 GB ceiling.
- The master-quality policy is open-ended: 24K, 16K, 12K, 8K, 4K and future higher resolutions may be preserved when the source, codec, storage and processing pipeline genuinely support them.
- Resolution labels must describe actual encoded/native detail. The system must never upscale lower-resolution material and present it as native 24K/16K/12K/8K.
- The archival master should preserve native frame size, frame rate, aspect ratio, bit depth, chroma format, transfer function, colour primaries, HDR metadata and audio characteristics whenever present and supported by the source/pipeline.
- Authorized files may use HTTP byte ranges, resumable delivery, chunked transfer, and parallel chunks when supported by the serving infrastructure.
- Large files should be streamed rather than loaded wholly into application memory.
- The encyclopedia player may expose quality choices such as **24K / 16K / 12K / 8K / 4K** plus lower tiers; choices must be generated from actual stored derivatives and viewer/device/network capability.
- Platform export is adaptive rather than restrictive: preserve the highest-quality master independently, then generate the highest resolution and format each external platform actually supports at publication time.
- If a platform later supports a higher resolution, the corresponding derivative may be generated without changing the master-quality policy.
- A lawful large PDF, video, audio file, image set, animated image, or 3D asset is not rejected merely because its size or resolution is large.
- Real infrastructure constraints (storage, bandwidth, reverse proxy, filesystem, origin, browser, device, display chain, or provider limits) remain infrastructure constraints; they are not application-level file-size caps.

`authorized source → rights/provenance/integrity → native master → quality derivatives → encyclopedia adaptive player / platform-specific exports`

For physical display and Data-show presentation, a claim of **true 24K** requires the delivered image signal and display architecture to provide corresponding native pixel detail or a documented tiled/multi-projector equivalent. A lower-resolution projector or panel must not be described as native 24K merely because it accepts a 24K input.

The repository stores policy and code, not large media objects themselves. The project follows a free-first design: no subscription is required by this application policy and no paid API is required for large-file authorization, quality selection, provenance, or validation.