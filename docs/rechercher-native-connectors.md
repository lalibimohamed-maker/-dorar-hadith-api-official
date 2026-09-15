# Rechercher Native Source Connectors

This layer is additive to the existing Rechercher acquisition engine. It discovers records through source-native interfaces, normalizes metadata, records provenance, and exposes lawful PDF candidates to the existing acquisition pipeline.

## Connector classes

- `rest-json`: source APIs that return JSON metadata.
- `iiif`: IIIF manifests/search endpoints for digitized collections.
- `oai-pmh`: metadata harvesting and repository identification.
- `sru`: library catalogue search services.
- `web-discovery`: a governed source entry point where no stable public machine interface has yet been verified.

## Safety boundary

Discovery is not permission. A discovered URL is never treated as public-domain or redistributable merely because it is reachable. Rights remain `unknown`/blocked until evidence supports a lawful action.

The native connector layer never modifies canonical Quran text, source PDFs, or the Corpus. Successful PDF candidates are handed to the established Rechercher acquisition/validation pipeline.

## Current registry

The registry covers international library/digital-heritage sources plus Islamic heritage/text sources, including Internet Archive, Open Library, OpenITI/KITAB, Wikimedia Commons, Library of Congress, Crossref, Google Books, Gallica/BnF, British Library/EAP, Princeton PUL, Bodleian, Cambridge, Vatican, Qatar Digital Library, NYU ACO, Al-Furqan, Waqfeya and Al-Maktaba Al-Shamela.

Open Library is intentionally treated as a discovery/lookup source rather than a bulk-download backend, in accordance with its published API guidance. OpenITI is treated as a corpus/repository source rather than a library UI. citeturn0search9turn0search4turn0search5

## Operations

```text
query
  -> native federation
  -> per-source telemetry
  -> metadata normalization
  -> deduplication
  -> rights/availability gate
  -> existing PDF acquisition engine
  -> PDF validation + provenance
```

Every source is independently observable. A failing connector must not stop the federation run.
