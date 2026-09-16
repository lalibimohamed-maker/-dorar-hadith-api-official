const ISLAMHOUSE_API_KEY = process.env.ISLAMHOUSE_API_KEY;

export const VERIFIED_MULTILINGUAL_CONNECTORS = Object.freeze([
  {
    id: 'islamhouse', name: 'IslamHouse Developer API', enabled: Boolean(ISLAMHOUSE_API_KEY),
    acquisition: 'metadata-and-pdf-when-permitted', rightsPolicy: 'islamhouse-developer-terms-and-item-rights',
    connector: { kind: 'rest-json-keyed-path', requiresEnv: 'ISLAMHOUSE_API_KEY', endpointTemplate: 'https://api.islamhouse.com/v1/{API_KEY}/main/books/ar/showall/{page}/25/json/', queryMap: () => ({ page: 1 }),
      mapResults: (json) => (json?.data ?? []).map((d) => ({ identifier: d.source_id ?? d.id, title: d.title, language: d.source_language, itemUrl: d.api_url ?? null, rightsUrl: 'https://api2.islamhouse.com/ar/docs/islamhouse', pdfUrl: (d.attachments ?? []).find((a) => String(a.extension_type).toUpperCase() === 'PDF')?.url ?? null, rightsStatus: 'source-declared', method: 'islamhouse-developer-api' })),
    },
  },
  {
    id: 'quranenc', name: 'QuranEnc Developer API', enabled: true, acquisition: 'multilingual-quran-api', rightsPolicy: 'quranenc-republication-terms',
    connector: { kind: 'rest-json-catalog', searchUrl: 'https://quranenc.com/api/v1/translations/list', queryMap: () => ({}),
      mapResults: (json, query) => (Array.isArray(json) ? json : []).filter((d) => !query || `${d.title ?? ''} ${d.description ?? ''} ${d.language_iso_code ?? ''} ${d.key ?? ''}`.toLowerCase().includes(String(query).toLowerCase())).map((d) => ({ identifier: d.key, title: d.title, language: d.language_iso_code, itemUrl: `https://quranenc.com/api/v1/translation/sura/${encodeURIComponent(d.key)}/1`, rightsUrl: 'https://quranenc.com/ar/home/api', rightsStatus: 'verified-source-terms', method: 'quranenc-developer-api' })),
    },
    notes: 'Official documented JSON API; reuse remains subject to the published source terms.',
  },
  {
    id: 'hadeethenc-api', name: 'Encyclopedia of Translated Prophetic Hadiths Developer API', enabled: true, acquisition: 'multilingual-hadith-api', rightsPolicy: 'publisher-declared',
    connector: { kind: 'rest-json-catalog', searchUrl: 'https://hadeethenc.com/api/v1/hadeeths/list/', queryMap: () => ({ language: 'ar', category_id: 1, page: 1, per_page: 20 }),
      mapResults: (json, query) => (Array.isArray(json) ? json : (json?.data ?? [])).filter((d) => !query || `${d.title ?? ''} ${d.hadeeth ?? ''}`.toLowerCase().includes(String(query).toLowerCase())).map((d) => ({ identifier: d.id, title: d.title, language: 'ar', itemUrl: `https://hadeethenc.com/api/v1/hadeeths/one/?id=${encodeURIComponent(d.id)}&language=ar`, rightsUrl: 'https://hadeethenc-content.islamcontent.com/en/developers_api', rightsStatus: 'publisher-declared', method: 'hadeethenc-developer-api-v1' })),
    },
    notes: 'The hadith-list endpoint requires a category_id in its native contract; category 1 is used only as a deterministic health/probe seed. Category discovery remains available through the native categories endpoints, and acquisition remains independent.',
  },
  {
    id: 'islamenc-api', name: 'IslamEnc Developer APIs', enabled: true, acquisition: 'multilingual-quran-hadith-and-islamic-content-api', rightsPolicy: 'publisher-declared',
    connector: { kind: 'rest-json-catalog', searchUrl: 'https://s.islamenc.com/api/v1/services', queryMap: () => ({}),
      mapResults: (json, query) => (Array.isArray(json) ? json : (json?.['main-services'] ?? [])).filter((d) => !query || `${d.title ?? ''} ${d.ar_title ?? ''} ${d.description ?? ''}`.toLowerCase().includes(String(query).toLowerCase())).map((d) => ({ identifier: d.id, title: d.title ?? d.ar_title, language: d.language?.lang_code ?? null, itemUrl: d.link ?? null, rightsUrl: 'https://s.islamenc.com/lang/en', rightsStatus: 'publisher-declared', method: 'islamenc-services-api-v1' })),
    },
    notes: 'Official GET /api/v1/services catalog extracted from the IslamEnc developer portal; service-level reuse remains publisher-declared.',
  },
]);

export function verifiedMultilingualSources() {
  return VERIFIED_MULTILINGUAL_CONNECTORS.map((source) => ({ ...source, connector: { ...source.connector } }));
}
