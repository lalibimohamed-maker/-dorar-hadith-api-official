/**
 * Verified multilingual native connectors.
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
]);

export function verifiedMultilingualSources() {
  return VERIFIED_MULTILINGUAL_CONNECTORS.map((source) => ({
    ...source,
    connector: { ...source.connector },
  }));
}
