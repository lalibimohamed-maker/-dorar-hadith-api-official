const DEFAULT_TIMEOUT_MS = 15_000;

export const CONNECTOR_KINDS = Object.freeze([
  'rest-json',
  'rest-json-keyed-path',
  'iiif',
  'oai-pmh',
  'sru',
  'web-discovery',
]);

function withQuery(url, params = {}) {
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') target.searchParams.set(key, String(value));
  }
  return target;
}

function normalizeRecord(record, source) {
  return {
    sourceId: source.id,
    sourceName: source.name,
    connectorKind: source.connector.kind,
    identifier: record.identifier ?? record.id ?? record.url ?? null,
    title: record.title ?? null,
    author: record.author ?? null,
    year: record.year ?? null,
    language: record.language ?? null,
    itemUrl: record.itemUrl ?? record.url ?? null,
    pdfUrl: record.pdfUrl ?? null,
    rightsUrl: record.rightsUrl ?? null,
    rightsStatus: record.rightsStatus ?? 'unknown',
    provenance: {
      discoveredAt: new Date().toISOString(),
      method: record.method ?? source.connector.kind,
    },
  };
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        accept: options.accept ?? 'application/json',
        'user-agent': 'DeenAllah-Rechercher/1.0 (+https://github.com/lalibimohamed-maker/-dorar-hadith-api-official)',
        ...(options.headers ?? {}),
      },
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { response, text, json: options.parseJson === false ? null : JSON.parse(text) };
  } finally {
    clearTimeout(timeout);
  }
}

async function restSearch(source, query, options) {
  const url = withQuery(source.connector.searchUrl, source.connector.queryMap(query));
  const { json } = await fetchJson(url, options);
  return source.connector.mapResults(json).map((record) => normalizeRecord(record, source));
}

async function keyedPathSearch(source, query, options) {
  const apiKey = process.env[source.connector.requiresEnv];
  if (!apiKey) return [];
  const page = Number(source.connector.queryMap(query)?.page ?? 1);
  const url = source.connector.endpointTemplate
    .replace('{API_KEY}', encodeURIComponent(apiKey))
    .replace('{page}', String(Math.max(1, page)));
  const { json } = await fetchJson(url, options);
  return source.connector.mapResults(json).map((record) => normalizeRecord(record, source));
}

async function iiifSearch(source, query, options) {
  const url = withQuery(source.connector.searchUrl, source.connector.queryMap(query));
  const { json } = await fetchJson(url, options);
  return source.connector.mapResults(json).map((record) => normalizeRecord(record, source));
}

async function oaiIdentify(source, options) {
  const url = withQuery(source.connector.endpoint, { verb: 'Identify' });
  const { text } = await fetchJson(url, { ...options, accept: 'application/xml', parseJson: false });
  return [{ ...normalizeRecord({ identifier: source.id, url: url.toString(), method: 'oai-pmh-identify' }, source), rawLength: text.length }];
}

export async function searchConnector(source, query, options = {}) {
  if (!source?.enabled) return [];
  switch (source.connector.kind) {
    case 'rest-json': return restSearch(source, query, options);
    case 'rest-json-keyed-path': return keyedPathSearch(source, query, options);
    case 'iiif': return iiifSearch(source, query, options);
    case 'oai-pmh': return oaiIdentify(source, options);
    case 'sru': return restSearch(source, query, options);
    case 'web-discovery': return [];
    default: throw new Error(`Unsupported connector kind: ${source.connector.kind}`);
  }
}

export async function probeConnector(source, options = {}) {
  const started = Date.now();
  try {
    if (source.connector.kind === 'web-discovery') {
      return { sourceId: source.id, status: 'configured', elapsedMs: Date.now() - started };
    }
    if (source.connector.requiresEnv && !process.env[source.connector.requiresEnv]) {
      return { sourceId: source.id, status: 'configured', reason: `missing runtime secret ${source.connector.requiresEnv}`, elapsedMs: Date.now() - started };
    }
    await searchConnector(source, 'test', { ...options, timeoutMs: options.timeoutMs ?? 10_000 });
    return { sourceId: source.id, status: 'healthy', elapsedMs: Date.now() - started };
  } catch (error) {
    return { sourceId: source.id, status: 'degraded', elapsedMs: Date.now() - started, error: error.message };
  }
}

export function createConnectorManifest(sources) {
  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    enabled: source.enabled !== false,
    kind: source.connector.kind,
    acquisition: source.acquisition ?? 'metadata-only',
    rightsPolicy: source.rightsPolicy ?? 'unknown-blocked',
    endpoints: source.connector.endpoint ? [source.connector.endpoint] : source.connector.searchUrl ? [source.connector.searchUrl] : source.connector.endpointTemplate ? [source.connector.endpointTemplate] : [],
  }));
}
