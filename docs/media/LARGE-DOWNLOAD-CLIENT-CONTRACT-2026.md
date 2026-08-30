# Large Media Download Client Contract — 2026

The encyclopedia's browser and mobile clients must be able to download authorized large Islamic media without an artificial application-level file-size ceiling.

- The application-level maximum file size is intentionally unset (`null`): **no application-imposed size limit**.
- A large-file size such as 20 GB is a regression-test case, not a maximum; the policy does not establish a 20 GB ceiling.
- Authorized files may use HTTP byte ranges, resumable delivery, chunked transfer, and parallel chunks when supported by the serving infrastructure.
- Large files should be streamed rather than loaded wholly into application memory.
- Rights, provenance, malware/integrity, and publication gates remain mandatory regardless of file size.
- A lawful large PDF, video, audio file, image set, animated image, or 3D asset is not rejected merely because its size is large.
- Real infrastructure constraints (storage, bandwidth, reverse proxy, filesystem, origin, browser, device, or provider limits) remain infrastructure constraints; they are not application-level file-size caps.

`browser/mobile → HTTPS → authorized origin/object storage → Range/Resume → streamed file`

The repository stores the policy and code, not the large media objects themselves. The project follows a free-first design: no subscription is required by this application policy and no paid API is required for large-file authorization or validation.