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

Open Library is intentionally treated as a discovery/lookup source rather than a bulk-download backend, in accordance with its published API guidance. OpenITI is treated as a corpus/repository source rather than a library UI.

## Country registries

Rechercher now has a separate country registry layer at `config/rechercher-country-source-registries.js`. It is deliberately separate from the global native registry so each country can grow independently without mixing institutional metadata into the Corpus.

The first census covers the 22 Arab League member states as country-level registries. Each registry starts with national libraries/archives, Islamic-affairs or awqaf institutions, Islamic universities, manuscript repositories, and academic repositories where a public official entry point could be identified.

Saudi Arabia receives a deeper registry rather than a single `web-discovery` entry. It currently includes 21 institutional/collection entries spanning the King Fahd National Library, King Abdulaziz Foundation for Research and Archives, King Abdulaziz Complex for Waqf Libraries, King Salman Global Academy for Arabic Language, Ministry of Islamic Affairs e-library, national manuscript availability platform, the Haramayn libraries, Saudi Digital Library, and Saudi university repositories.

The UAE and Qatar registries likewise include Islamic-heritage and manuscript collections such as Abu Dhabi's Dar Al Kutub, Al Jami' Library, Sharjah's digital repository, Qatar Digital Library, Waqf Index, and Qatar National Library.

A country entry is not automatically an API. `web-discovery` is retained until a stable native REST, OAI-PMH, SRU, IIIF, or equivalent public interface is verified. This prevents Rechercher from inventing APIs or bypassing access controls.

## Country-registry flow

```text
country registry
  -> institutional source
  -> verify native interface
  -> promote to REST/OAI/SRU/IIIF connector
  -> metadata normalization
  -> provenance + rights gate
  -> existing real-PDF acquisition engine
```

The country registry is therefore a living source census: adding an institution does not grant download rights, and promoting a source to a native connector requires interface verification.

## Operations

```text
query
  -> native federation
  -> global + country source registries
  -> per-source telemetry
  -> metadata normalization
  -> deduplication
  -> rights/availability gate
  -> existing PDF acquisition engine
  -> PDF validation + provenance
```

Every source is independently observable. A failing connector must not stop the federation run.
