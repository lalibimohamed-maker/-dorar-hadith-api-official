# Free-First Knowledge Processing Engines — 2026

This document records free/open-source engines selected for the Din Allah Encyclopedia processing architecture. These engines are optional processing layers; they must never rewrite the canonical Corpus.

## Selected engines

| Function | Engine | License / constraint | Role |
|---|---|---|---|
| OCR | Tesseract OCR | Apache-2.0 | Local OCR baseline; preserve source image and verification state. |
| Document understanding | PaddleOCR | Apache-2.0 | Multilingual document parsing and structured extraction; useful for PDFs, tables and complex layouts. |
| Speech-to-text | whisper.cpp | Project/model licenses must be tracked | Local transcription; record language and model provenance. |
| Text-to-speech | Piper | GPL-3.0-or-later; each voice model must be checked separately | Local narration and accessibility. |
| Semantic knowledge graph | Apache Jena | Apache-2.0 | RDF/OWL/SPARQL graph layer for source relationships and provenance. |

## Free-first rule

1. Prefer local and open-source engines.
2. No paid provider is a required dependency.
3. External services may be optional adapters only.
4. A tool may not silently alter canonical Quran, hadith, tafsir, fiqh or other verified source text.
5. Every derived artifact must retain provenance, engine/version and verification state.
6. License compatibility must be checked before distributing an engine, model or voice inside a release.

## Why these additions

PaddleOCR provides multilingual document understanding and structured extraction and currently advertises support for more than 100 languages. Apache Jena supplies RDF/OWL APIs, SPARQL querying and inference capabilities. Piper provides local neural text-to-speech with a web server, Python API and C/C++ API. These capabilities complement the existing OCR and speech-to-text layers without requiring a paid API.

## Sources

- PaddleOCR: https://github.com/PaddlePaddle/PaddleOCR
- Apache Jena: https://jena.apache.org/
- Piper: https://github.com/OHF-Voice/piper1-gpl
- Tesseract: https://github.com/tesseract-ocr/tesseract
- whisper.cpp: https://github.com/ggml-org/whisper.cpp
