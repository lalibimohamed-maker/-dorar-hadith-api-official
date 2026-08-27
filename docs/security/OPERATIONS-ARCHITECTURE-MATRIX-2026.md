# Operations Architecture Matrix — 2026

This matrix turns the requested "all systems" concept into controlled capability classes. A product name is never treated as proof that a capability is installed, active, safe, licensed, or authoritative.

## Operating rule

`discover → classify → license-check → pin/verify → sandbox/quarantine → scan → test → independent review → promote`

No component may silently mutate protected `main`, trusted Corpus records, scholarly source text, trusted baselines, rights metadata, or security policy.

## Capability classes

| Capability | Function | Preferred/open tooling | Current repository status | Safety boundary |
|---|---|---|---|---|
| Malware detection | detect, scan, classify | ClamAV, YARA, Trivy, Gitleaks, CodeQL | active CI controls | high-confidence policy hit blocks promotion; no automatic deletion |
| File integrity | hashes, manifests, tamper detection | SHA-256 plus repository manifests; restic/Borg candidates for deployed backups | integrity controls active; backup tools not claimed installed | restore must be verified and rescanned |
| Backup/recovery | snapshot, restore, consistency checks | restic or BorgBackup | deployment candidate | restore into quarantine before promotion |
| Download | retry, resume, bounded retrieval | native HTTP client; rclone where explicitly authorized | controlled by source policy | download is not redistribution permission |
| Media | decode, transcode, extract audio, thumbnails | FFmpeg | deployment candidate | resource limits and source/derived lineage |
| OCR/document | OCR, normalization, extraction | Tesseract plus source-image retention | deployment candidate | OCR is derived evidence, never authoritative by itself |
| Storage/cache | encrypted storage, deduplication, cache | restic/Borg/rclone where authorized | deployment candidate | cache is separated from trusted source and Corpus |
| Supply chain | dependency update, SBOM, attestations | Dependabot, Dependency Review, CycloneDX, Sigstore, GitHub Artifact Attestations, Scorecard | active/partially active | proposals and attestations never replace scanning/review |
| Runtime sensing | host/file integrity and runtime events | Wazuh, Falco | optional external | alerts are read-only inputs until explicitly approved |
| Orchestration | scheduling and resource management | GitHub Actions; Flux only for a demonstrated HPC need | GitHub Actions active | orchestration never grants unrestricted repository authority |
| System environment | OS/runtime/package health | CI health checks and pinned toolchains | active | unknown or failed environment state is fail-closed |

## Self-healing policy

Safe automatic recovery is restricted to non-authoritative artifacts: rebuild a cache, regenerate a derived artifact from a verified source, restore a verified artifact into quarantine, and rerun validation.

The following always require a protected flow and appropriate review: writing trusted Corpus, replacing a verified scholarly source, deleting trusted content, changing rights/provenance, changing security policy, changing branch protection, or changing trust baselines.

## Update policy

Automatic maintenance may discover updates, open protected PRs, run checks, and report vulnerabilities. It may not silently modify `main`, silently change security policy, or silently promote scholarly content.

## Tool selection rule

Tools such as SaveFrom-like web services and torrent clients are not core trust components. They may only be evaluated as controlled acquisition mechanisms when their exact source, licensing, legal/rights status, network behavior, and quarantine path are established.

The term `Flux` is ambiguous; this matrix does not claim any Flux product is installed. The exact project and required workload must be identified before adoption. The same rule applies to any unspecified `FSS` or similarly named system.

## 4K/8K/12K/16K media roadmap

Media processing is capability-based rather than resolution-claimed. The system records source format, codec, dimensions, bitrate, processing parameters, resource limits, derived-artifact lineage, and validation result. Higher resolutions are supported when the deployment environment and selected codec stack can actually process them; no future capability is represented as currently implemented.

## Two-account governance

The primary maintainer account may propose and perform protected merges. The secondary account `lalibimohamed82-coder` remains an independent reviewer for high-impact security, workflow, recovery, and governance changes. A prior approval becomes stale when the PR head changes in a way covered by the review rules.

## Evidence standard

`implemented` means code/configuration evidence or a positive GitHub control-plane signal proves the state. `candidate`, `optional-external`, and `not-approved-as-core` must not be described as installed or active.
