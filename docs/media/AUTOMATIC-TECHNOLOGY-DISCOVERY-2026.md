# Automatic Technology Discovery and Upgrade Policy — 2026

The encyclopedia continuously watches a curated set of upstream projects for newer releases and capability improvements.

## What is automatic

- periodic discovery of upstream releases and tags;
- reporting of new versions and candidate tools;
- dependency update proposals through Dependabot;
- protected pull requests, CI/security validation, and review workflows;
- recording the upstream identity and evidence needed for evaluation.

GitHub Dependabot supports scheduled package and GitHub Actions version updates and can group compatible updates into focused pull requests. It does not by itself mean that arbitrary new software is safe or appropriate. See GitHub's Dependabot documentation for the supported configuration model.

## What is intentionally not automatic

The discovery service does not silently install, execute, trust, or promote an unknown tool. A newly discovered system must pass identity, license, security, compatibility, resource, provenance, and integration checks before it can be proposed for adoption.

A protected PR remains the change boundary. Trusted Corpus, scholarly source text, rights/provenance metadata, security policy, and protected `main` are never mutated by discovery alone.

## Interoperability model

The architecture is capability-first rather than product-first:

`capability -> interface/format -> candidate implementation -> evidence -> sandbox -> tests -> review -> deployment`

This permits components to evolve independently while retaining stable boundaries for image, video, audio, OCR, storage, download, observability, and live-media functions.

## Self-maintenance

Safe self-healing is limited to rebuilding or restoring non-authoritative derived artifacts from verified sources, then rescanning and validating them. Recovery does not become a privileged route to delete trusted content or bypass review.

## Quality roadmap

Media profiles include 4K, 8K, and 12K targets. Higher resolutions are capability targets rather than claims about the current runner. The pipeline records source dimensions, output dimensions, codec/format, processing parameters, resource limits, and derived-artifact lineage.
