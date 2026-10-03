# VoiceStudio-derived runtime hardening

VoiceStudio's recent releases demonstrate several reliability patterns worth adopting in Rechercher: a Model Catalogue, real engine self-tests, recovery of partial model downloads, crash isolation, resource-aware routing, and resumable long-form rendering. These are adopted as architecture patterns only.

## Adopted
- Installation is not readiness.
- A runtime is ready only after loadability and real inference evidence.
- Partial downloads remain incomplete until size and checksum validation pass.
- Resource pressure selects a lighter profile instead of forcing a large model.
- Runtime failures must remain diagnosable and isolated from the application shell.
- Long-form audio work should checkpoint and resume rather than restart completed work.

## Not adopted
- VoiceStudio application code is not copied.
- AGPL does not become a license for this repository.
- Model licenses remain independent evidence records.
- Remote workers remain opt-in.
- Quran recitation remains original verified audio.
- No voice operation may modify Corpus or scholarly source content.

## Rechercher gate
`declared -> acquired -> checksum-verified -> license-reviewed -> loadable -> inference-verified`

Only the final state may be reported as runtime-complete.