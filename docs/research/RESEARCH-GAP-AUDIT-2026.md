# Research capability gap audit — 2026-08-30

This audit records additional capability classes identified during a web review of the encyclopedia research/search architecture.

## Added capability classes
- Document understanding: Docling and GROBID.
- Arabic NLP: CAMeL Tools and GLiNER.
- Semantic retrieval: FAISS and OpenSearch reranking.
- Knowledge graph: Apache Jena / RDF / SPARQL.
- Audio: whisper.cpp and speaker diarization with pyannote.audio, subject to model-license checks.

## Control layers
- quote context expansion
- claim extraction
- entity resolution
- relation extraction
- temporal consistency checking
- document structure validation
- speaker attribution validation
- semantic deduplication
- knowledge-graph linking
- evidence completeness checking

## Governance
Tools are acquisition/analysis instruments, not truth authorities. Model weights are licensed separately from source code. Uncertain attribution fails closed. Every derived claim retains source, location and context provenance.
