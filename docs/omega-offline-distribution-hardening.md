# Rechercher Ω — Offline Distribution & UI Hardening

## Integrity contract

Omega distribution uses complementary integrity layers:

1. Whole-file SHA-256 identifies the exact downloaded artifact.
2. Per-block SHA-256 protects fixed resume blocks.
3. Cumulative Rolling SHA-256 binds the ordered block sequence, including index, byte offset, byte length and block digest.
4. SHA-256 Merkle root binds the same block descriptors in a deterministic tree with the duplicate-last rule for odd levels.
5. Distribution roots bind each chunk digest and its per-chunk Rolling/Merkle roots.

These values are deterministic and reproducible. They do not replace authentication: a trusted Ed25519-signed manifest remains the trust anchor for promotion.

## Signed manifest boundary

`src/distribution/omega-manifest-signature.js` canonicalizes the manifest by recursively sorting object keys and excluding only `artifact.signature.signature_base64` from the signed bytes. Verification uses a caller-supplied trusted public-key map.

`validateOfflineInstallManifest()` can enforce the signature with `requireAuthenticatedSignature: true`.

## Resumable download behavior

`ByteRangeResumeEngine` resumes only from locally verified blocks. A resumed request is accepted only when the server returns HTTP `206` with matching `Content-Range`; validator enforcement can require `ETag` or `Last-Modified`.

A server that ignores `Range` and returns `200` causes a restart from byte zero; the full response is never appended to a partial object.

## Mobile local loading guard

The browser loader uses same-origin module URLs and a bounded readiness timeout. The timeout controls the application's fallback decision; it does not claim to cancel the native `import()` operation.

`auto` may use an online fallback after local readiness timeout or failure. `offline_only` never uses that fallback.

## Arabic retrieval robustness

Arabic normalization is retrieval-only. The raw query is preserved, and variants include the original text, Tatweel removal, diacritics removal, controlled letter normalization and controlled `ى/ي` and `ة/ه` variants.

No canonical Corpus source text is rewritten.

## Offline UI/UX

The web UI exposes:

- explicit runtime modes: `auto`, `offline_only`, `online_only`
- live network state
- local storage usage estimate
- quick search button and `/` keyboard shortcut
- loading skeleton and progress indicator
- reduced-motion behavior
- explicit offline error states instead of fake network success
- Service Worker registration for the local web shell

The page can register local providers through `window.deenAllahRegisterLocalOmegaProviders({ search, concept })`. This is an integration boundary; absence of a provider is shown as unavailable local evidence.

## Mobile field resilience

The browser runtime now includes OmegaHardwareGuardian and a resumable local audio frame journal.

### Storage persistence

The runtime requests navigator.storage.persist() and re-checks persisted(); a positive result changes the origin to persistent storage mode where supported. This is a request governed by browser policy, not an unconditional OS whitelist. When persistence is denied or unavailable, the UI must continue to surface the condition rather than claim protection.

### Audio interruption

OmegaHardwareGuardian.monitorAudioContextResilience() observes AudioContext.state and page visibility. On suspension/interruption it records a session checkpoint in IndexedDB. OmegaResilientAudioSession journals each PCM frame before feeding it into the STT adapter, assigning a monotonically increasing sequence and byte offset; pending frames are replayed in order after resume.

This makes the byte-offset boundary explicit. It does not claim that an arbitrary third-party STT implementation is lossless unless that adapter feeds the journal before consuming each frame.

### WebGPU device loss

The inference worker observes the GPUDevice.uncapturederror event and GPUDevice.lost. On non-intentional loss, the worker switches to a smaller WASM chunk size and, when the generator does not expose a backend-switch method, recreates the local generator with backend: wasm. The worker never interprets an error event as a successful generation.

### Manual device matrix

These conditions require real-device validation because CI cannot reproduce mobile OS resource arbitration reliably:

- iOS/iPadOS Safari or Home Screen Web App: start microphone capture, background the app, trigger an interruption, return, and verify the same session ID resumes from the stored sequence/byte offset.
- Android Chrome: repeat background/foreground and an audio-focus interruption; verify pending PCM frames replay in order.
- Storage pressure: fill device storage sufficiently to create pressure, verify the UI reports persistence status and that import failures are explicit rather than silently deleting or replacing the local index.
- WebGPU: start local generation, provoke a device-loss condition where reproducible, and verify the worker emits runtime-fallback with backend: wasm and reduced chunk_size.
- Low-memory import: import a large evidence bundle and verify the UI remains responsive while worker progress events continue.

These tests complement, rather than replace, the deterministic CI contracts.

## Browser API compatibility notes

GPUDevice exposes uncapturederror and lost; there is no navigator.gpu.onuncaughterror event used by this runtime. The guard therefore attaches to the actual GPUDevice object. Reference: https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/uncapturederror_event and https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/lost.

navigator.storage.persist() requests persistent storage and may be denied according to browser heuristics. WebKit documents eviction under storage pressure and persistent-mode exemptions, including on supported iOS/iPadOS Home Screen web apps. References: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist and https://webkit.org/blog/14403/updates-to-storage-policy/.

## Scope
No Corpus scholarly text is modified.
No model weights are committed.
No Git LFS is introduced.
