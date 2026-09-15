/**
 * Verified multilingual native/API connectors.
 * Additive only: no Corpus writes and no rights bypass.
 */

const ISLAMHOUSE_API_KEY = process.env.ISLAMHOUSE_API_KEY;

export const VERIFIED_MULTILINGUAL_CONNECTORS = Object.freeze([
  {
    id: 'islamhouse',
    name: 'IslamHouse Developer API',
    enabled: Boolean(ISLAMHOUSE_API_KEY),
    acquisition: 'metadata-and-pdf-when-permitted',
    rightsPolicy: 'islamhouse-developer-terms-and-item-rights',
    connector: {
      kind: 'rest-json-keyed-path',
      requiresEnv: 'ISLAMHOUSE_API_KEY',
      endpointTemplate: 'https://api.islamhouse.com/v1/{API_KEY}/main/books/ar/showall/{page}/25/json/',
      queryMap: () => ({ page: 1 }),
      mapResults: (json) => (json?.data ?? []).map((d) => ({
        identifier: d.source_id ?? d.id,
        title: d.title,
        language: d.source_language,
        itemUrl: d.api_url ?? null,
        rightsUrl: 'https://api2.islamhouse.com/ar/docs/islamhouse',
        pdfUrl: (d.attachments ?? []).find((a) => String(a.extension_type).toUpperCase() === 'PDF')?.url ?? null,
        rightsStatus: 'source-declared',
        method: 'islamhouse-developer-api',
      })),
    },
  },
  {
    id: 'quranenc',
    name: 'QuranEnc Developer API',
    enabled: true,
    acquisition: 'multilingual-quran-api',
    rightsPolicy: 'quranenc-republication-terms',
    connector: {
      kind: 'rest-json-catalog',
      searchUrl: 'https://quranenc.com/api/v1/translations/list',
      queryMap: () => ({}),
      mapResults: (json, query) => (Array.isArray(json) ? json : [])
        .filter((d) => !query || `${d.title ?? ''} ${d.description ?? ''} ${d.language_iso_code ?? ''} ${d.key ?? ''}`.toLowerCase().includes(String(query).toLowerCase()))
        .map((d) => ({
          identifier: d.key,
          title: d.title,
          language: d.language_iso_code,
          itemUrl: `https://quranenc.com/api/v1/translation/sura/${encodeURIComponent(d.key)}/1`,
          rightsUrl: 'https://quranenc.com/ar/home/api',
          rightsStatus: 'verified-source-terms',
          method: 'quranenc-developer-api',
        })),
    },
    notes: 'Official documented JSON API. Translation republication is permitted subject to the source terms: no modification/addition/deletion, attribution, version retention, source notification, updates, and no inappropriate advertising.',
  },
  {
    id: 'hadeethenc-api',
    name: 'Encyclopedia of Translated Prophetic Hadiths Developer API',
    enabled: true,
    acquisition: 'multilingual-hadith-api',
    rightsPolicy: 'publisher-declared',
    connector: {
      kind: 'web-discovery',
      searchUrl: 'https://hadeethenc-content.islamcontent.com/en/developers_api',
      queryMap: (query) => ({ q: query }),
      mapResults: () => [],
    },
    notes: 'Official developer portal and Postman collection are documented; endpoint details are retained as API discovery until the machine-readable endpoint contract is verified. No guessed endpoint is executed.',
  },
  {
    id: 'islamenc-api',
    name: 'IslamEnc Developer APIs',
    enabled: true,
    acquisition: 'multilingual-quran-hadith-and-islamic-content-api',
    rightsPolicy: 'publisher-declared',
    connector: {
      kind: 'web-discovery',
      searchUrl: 'https://s.islamenc.com/lang/en',
      queryMap: (query) => ({ q: query }),
      mapResults: () => [],
    },
    notes: 'Official portal documents APIs for the Quran Encyclopedia, Prophetic Hadith Encyclopedia, and translated Islamic content. Endpoint contracts and reuse terms are verified separately before native execution.',
  },
]);

export function verifiedMultilingualSources() {
  return VERIFIED_MULTILINGUAL_CONNECTORS.map((source) => ({
    ...source,
    connector: { ...source.connector },
  }));
}
