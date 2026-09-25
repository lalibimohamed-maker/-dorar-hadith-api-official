# Rechercher Ω — curated Hugging Face Space references

The Qwen3-0.6B ecosystem exposes many Hugging Face Spaces. Rechercher Ω
does **not** import all of them. A small curated set is recorded as
reference material for architecture, evaluation and capability discovery.

## Curated references

| Capability | Space | Rechercher use |
|---|---|---|
| Document Q&A / PDF RAG | `lfoppiano/document-qa` | retrieval and document-QA architecture reference |
| PDF RAG | `LovnishVerma/rag` | PDF ingestion/RAG reference |
| RAG evaluation | `aizip-dev/SLM-RAG-Arena` | groundedness and small-model evaluation reference |
| Multilingual speech | `k2-fsa/OmniVoice` | speech/TTS architecture reference |
| Arabic/dialect speech | `oddadmix/Lahgtna-OmniVoice-Demo` | Arabic voice reference |
| Official PaddleOCR-VL demo | `PaddlePaddle/PaddleOCR-VL_Online_Demo` | OCR/document parsing reference |
| Community PaddleOCR-VL deployment | `Upsampler/paddleocr-vl` | OCR/document parsing reference |
| Community PaddleOCR-VL demo | `waytoAGI/PaddleOCR-VL_Online_Demo` | OCR/document parsing reference |
| Multilingual tokenizer benchmark | `eduagarcia/multilingual-tokenizer-leaderboard` | tokenizer comparison reference |
| Tokenization | `aiqtech/LLM-Token-Visual` | multilingual/Arabic token analysis reference; currently paused |
| Hallucination QA | `hugging-apps/enoki-hallucination-detector` | quality-assurance reference |

## Boundary

These Spaces are **reference-only**:

- no Space is an automatic execution backend;
- no Space code is copied into the Corpus;
- no Space is automatically mirrored;
- a Space's license is not inferred from Qwen3-0.6B's Apache-2.0 license;
- derived models and training data require their own license review;
- generated output is never scholarly evidence;
- no reference can write directly to Corpus.

## Adapter strategy

Rechercher Ω should implement native adapters for the *capabilities* demonstrated
by these references rather than depending on the Spaces themselves:

1. document extraction → normalized evidence candidates;
2. retrieval → source IDs and hashes;
3. RAG → grounded answer candidates;
4. RAG evaluation → evidence fidelity/groundedness measurements;
5. speech → voice artifact with provenance;
6. Arabic speech → language/dialect-specific voice candidates;
7. tokenizer analysis → language-aware token diagnostics;
8. hallucination checks → QA flags, never a truth oracle.\n9. PaddleOCR-VL document parsing → OCR/layout/table/formula/chart candidates with source provenance.\n10. Benchmark references → regression measurements; benchmark scores are not treated as scholarly evidence.

The machine-readable registry is
`config/rechercher-omega-space-registry.json`; its runtime boundary is
`src/rechercher-omega-space-registry.js`.
