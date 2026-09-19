# Privacy & Anti-Spy Guard — 2026

The encyclopedia must minimize surveillance and data exposure while preserving functionality.

## Controls

- Microphone, camera, location, and Bluetooth are permission-gated and feature-scoped.
- Background microphone/camera use is off by default and visibly indicated when active.
- No advertising identifiers, cross-site tracking, or device fingerprinting by default.
- Unknown network endpoints are denied; external AI/voice services require explicit consent.
- Third-party SDKs require inventory, purpose, data-flow declaration, and privacy review before production.
- Sensitive data must not be sent to SDKs or services before consent.
- Raw audio/video are ephemeral by default; search history is local and user-deletable.
- Prefer on-device processing when it can satisfy the feature.
- Privacy-sensitive APIs use secure contexts and restrictive Permissions Policy.
- Unexpected collection or transmission is a security event: quarantine, alert, and investigate.

## Evidence and testing

The gate maps to OWASP MASVS-PRIVACY controls for data minimization, prevention of user identification, transparency, and user control. Static and runtime tests should cover sensitive SDK APIs and actual data flows. This policy does not replace a legal privacy assessment where one is required.

## Corpus boundary

Privacy controls must never modify authoritative Corpus text. Audio, video, telemetry, analytics, and device signals are separate from scholarly content and provenance.
