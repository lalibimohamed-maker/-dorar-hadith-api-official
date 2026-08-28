# Large Media Download Client Contract — 2026

The encyclopedia's browser and mobile clients must be able to download authorized large Islamic media without an artificial 20 MB application ceiling.

## Delivery contract

- The application-level maximum file size is unset (`null`).
- Authorized files may use HTTP byte ranges and resumable delivery.
- A client should resume interrupted transfers instead of restarting the entire file.
- The delivery path should preserve `Content-Length`, `Content-Range`, `Accept-Ranges`, `ETag`, and `Content-Type` when supplied by the authorized origin.
- Large files must be streamed; they must not be loaded wholly into application memory.
- Rights, provenance, malware/integrity, and publication gates remain mandatory regardless of file size.

## What this means for users

A lawful 8K/12K video, large PDF, audio file, image set, animated image, or 3D asset is not rejected merely because it is larger than 20 MB. A 20 GB video is technically deliverable through the application layer when the real storage/origin/network infrastructure supports it.

The phrase "no application-level size ceiling" does not mean unlimited storage, bandwidth, browser/device memory, filesystem capacity, proxy limits, or third-party service quotas.

## Architecture

`browser/mobile → HTTPS → authorized object/origin → Range/Resume → streamed file`

The Git repository stores code and policy, not the large media objects themselves.

## Security

A large file cannot bypass publication rights, provenance, malware scanning, or integrity verification. The client should display progress and support pause/resume where its platform permits it.
