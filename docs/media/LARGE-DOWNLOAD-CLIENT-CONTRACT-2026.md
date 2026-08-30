# Large Media Download Client Contract — 2026

The encyclopedia's browser and mobile clients must be able to download authorized large Islamic media without an artificial 20 MB application ceiling.

- The application-level maximum file size is unset (`null`).
- Authorized files use HTTP byte ranges and resumable delivery when the origin supports them.
- Large files are streamed rather than loaded wholly into application memory.
- Rights, provenance, malware/integrity, and publication gates remain mandatory regardless of file size.
- A lawful 8K/12K video, large PDF, audio file, image set, animated image, or 3D asset is not rejected merely because it exceeds 20 MB.
- A 20 GB file is technically deliverable when the real storage, origin, network, proxy, browser and device support it.

`browser/mobile → HTTPS → authorized origin/object storage → Range/Resume → streamed file`

The repository stores the policy and code, not the large media objects themselves.
