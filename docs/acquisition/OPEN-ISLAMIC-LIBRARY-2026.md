# Open Islamic Library acquisition — 2026-09-02

## Source
- Repository: https://github.com/mohammed-2-5/islamic-library-data
- Catalog: https://raw.githubusercontent.com/mohammed-2-5/islamic-library-data/master/data/catalog.json
- Upstream README states that classical Islamic texts in the dataset are public domain, while individual translations have their own licenses.

## Scope
- Catalog reported by upstream: 75 classical books.
- PDF editions reported by upstream: 44.
- Categories include hadith, tafseer, fiqh, aqeedah, seerah and tazkiyah.

## Acquisition rule
Only PDF entries explicitly exposed by the upstream catalog are fetched. The workflow preserves the upstream title, author, category, URL and SHA-256. Translation or other non-classical material is not inferred to be public domain from this declaration.

## Output
Downloads are retained as workflow artifacts pending integration into the permanent library store. A permanent public mirror must preserve the upstream license/attribution notices and must not be confused with Quran Foundation content, Qatar Digital Library content, or any other source with separate terms.
