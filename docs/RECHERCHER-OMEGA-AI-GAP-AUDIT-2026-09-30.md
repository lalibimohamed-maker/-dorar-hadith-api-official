# Rechercher Omega AI gap audit — 2026-09-30

| Requirement | Status | Evidence |
|---|---|---|
| Query normalization/de-noising | implemented | src/rechercher-omega-query-normalizer.js + test |
| Deterministic evidence gate | implemented | src/rechercher-omega-evidence-gate.js + test |
| Conflict preservation | implemented | src/rechercher-omega-conflict-resolution.js + test |
| Evidence-first orchestration | implemented | src/rechercher-omega-governed-run.js + test |
| Corpus write protection | implemented | governed runner returns corpusWrite=false |
| Generated media not evidence | implemented | governed runner + media policy |
| Release-only model weights | implemented | existing Omega release policy + acquisition queue |
| Dual-storage no-redownload gate | implemented | storage acquisition workflow checks primary + Omega |
| AI/MCP/API contracts | existing | existing branch gateway/MCP/OpenAPI/schema files |
| Graph evidence traversal | existing | existing graph evidence query/runtime |
| OCR / multimodal | existing | existing OCR pool/runtime/media files |
| Conversation memory | existing, volatile by default | existing conversation memory policy |
| Persistent raw conversation storage | intentionally not default | privacy/safety policy; optional store adapters remain separate |
| Paid core dependency | blocked by policy | free-first runtime policy |
