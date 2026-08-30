# Large-download client contract — 2026

The application imposes **no fixed maximum file size** for authorized media. `applicationMaxFileSizeBytes` is `null` and must remain so unless a future change is explicitly reviewed as a policy change.

A file may still be limited by real infrastructure or client constraints such as storage capacity, bandwidth, reverse-proxy configuration, filesystem limits, browser/device capability, or upstream-provider quotas. These are not application-level ceilings.

Authorized delivery supports HTTP range requests, resumable downloads, chunked transfer and parallel chunks where the transport/client supports them. Rights verification, source provenance, malware scanning and SHA-256 verification remain mandatory publication gates.

The client should expose only quality variants that actually exist or have been verified. A large pixel count must never be used to label an AI/upscaled derivative as a native source.
