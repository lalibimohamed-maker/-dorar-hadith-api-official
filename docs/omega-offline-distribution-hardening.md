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

## Scope

No Corpus scholarly text is modified.
No model weights are committed.
No Git LFS is introduced.
