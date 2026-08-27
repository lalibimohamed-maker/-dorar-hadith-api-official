# Free-first continuous fallback policy

Din Allah Encyclopedia must remain usable and maintainable without requiring a paid external provider.

## Automatic behavior

For each technical capability, the system keeps an ordered set of eligible free/open alternatives. On every scheduled health cycle it can:

1. Check the preferred engine/provider.
2. Check an eligible fallback when the preferred option is unavailable, unhealthy, incompatible, or materially outdated.
3. Select the highest-ranked healthy eligible option using capability, compatibility, freshness, and quality evidence.
4. Record the selected engine, version, reason for fallback, and evidence.
5. Re-test the preferred engine on later cycles and restore it when healthy.

This is automatic for **availability and technical health**. It is not permission to silently promote scholarly material.

## Scientific safety boundary

A fallback engine may discover, transform, index, transcribe, OCR, or analyze material, but it may not promote a scholarly record to the authoritative corpus merely because it succeeded technically. Scholarly promotion still requires provenance, rights, evidence, source identity, and the protected review/validation path.

## Better-by-evidence rule

"Better" means demonstrably better for the capability being evaluated: current supported version, successful health checks, compatible output, quality evidence, and no worse scientific or security assurance. Popularity, vendor branding, or a paid plan never makes an engine automatically preferable.

## Free-first boundary

No paid provider is required for baseline operation. A paid provider can only be considered later as an optional enhancement and must never become a single point of failure or silently replace the free path.

## Current registry

The machine-readable policy is `config/free-first-fallback-registry-2026.json`.
