# Global multilingual knowledge network

The encyclopedia treats language as a presentation layer over one shared knowledge graph.

## Rules

- Detect the user's language automatically.
- Reply in the user's language when possible, even when that language is not configured as a UI language.
- Keep UI language, query language, response language, and source language independent.
- Preserve original religious source text; translations never replace originals.
- Identify verified translations by translator and source.
- Clearly label machine translations.
- Preserve right-to-left and left-to-right direction automatically.
- Support mixed-language queries.
- Search across languages using canonical entities and aliases.
- Keep every religious claim linked to provenance.
- Treat videos, articles, and other media as media sources, not as religious authority by default.
- If evidence is insufficient, say so rather than inventing or upgrading a claim.

## Retrieval model

User language -> intent detection -> multilingual retrieval -> source verification -> provenance graph -> response in user language.

The language layer must not change the identity or evidentiary status of the underlying source.
