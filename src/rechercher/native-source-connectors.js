const DEFAULT_TIMEOUT_MS = 15_000;

export const CONNECTOR_KINDS = Object.freeze([
  'rest-json', 'rest-json-keyed-path', 'rest-json-catalog', 'iiif', 'oai-pmh', 'sru', 'web-discovery',
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
    sourceId: source.id, sourceName: source.name, connectorKind: source.connector.kind,
    identifier: record.identifier ?? record.id ?? record.url ?? null, title: record.title ?? null,
    author: record.author ?? null, year: record.year ?? null, language: record.language ?? null,
    itemUrl: record.itemUrl ?? record.url ?? null, pdfUrl: record.pdfUrl ?? null,
    rightsUrl: record.rightsUrl ?? null, rightsStatus: record.rightsStatus ?? 'unknown',
    provenance: { discoveredAt: new Date().toISOString(), method: record.method ?? source.connector.kind, ...(record.categoryId == null ? {} : { categoryId: record.categoryId }) },
  };
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, { method: options.method ?? 'GET', headers: { accept: options.accept ?? 'application/json', 'user-agent': 'DeenAllah-Rechercher/1.0 (+https://github.com/lalibimohamed-maker/-dorar-hadith-api-official)', ...(options.headers ?? {}) }, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) { const error = new Error(`HTTP ${response.status}`); error.status = response.status; throw error; }
    return { response, text, json: options.parseJson === false ? null : JSON.parse(text) };
  } finally { clearTimeout(timeout); }
}

function retryable(error, retryStatuses) { return retryStatuses.includes(Number(error?.status)); }

async function fetchJsonWithRetry(url, options = {}) {
  const maxRetries = Math.max(0, Number(options.maxRetries ?? 0));
  const retryStatuses = options.retryStatuses ?? [429, 500, 502, 503, 504];
  for (let attempt = 0; ; attempt += 1) {
    try { return await fetchJson(url, options); }
    catch (error) {
      if (attempt >= maxRetries || !retryable(error, retryStatuses)) throw error;
      const delayMs = Math.min(30_000, 500 * (2 ** attempt)) + Math.floor(Math.random() * 250);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
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
  const url = source.connector.endpointTemplate.replace('{API_KEY}', encodeURIComponent(apiKey)).replace('{page}', String(Math.max(1, page)));
  const { json } = await fetchJson(url, options);
  return source.connector.mapResults(json).map((record) => normalizeRecord(record, source));
}

async function catalogSearch(source, query, options) {
  const url = withQuery(source.connector.searchUrl, source.connector.queryMap(query));
  const { json } = await fetchJson(url, options);
  return source.connector.mapResults(json, query).map((record) => normalizeRecord(record, source));
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

function unwrapList(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.categories)) return json.categories;
  if (Array.isArray(json?.languages)) return json.languages;
  if (Array.isArray(json?.results)) return json.results;
  return [];
}

function extractLanguages(json) {
  return unwrapList(json).map((item) => typeof item === 'string' ? item : item?.language ?? item?.lang ?? item?.code ?? item?.iso_code ?? item?.language_code ?? item?.lang_code ?? null).filter(Boolean).map(String).filter((value, index, values) => values.indexOf(value) === index);
}

function extractCategories(json) {
  return unwrapList(json).map((item) => ({ id: item?.id ?? item?.category_id ?? item?.categoryId ?? null, language: item?.language ?? item?.lang ?? item?.language_code ?? null, title: item?.title ?? item?.name ?? item?.ar_title ?? null })).filter((item) => item.id !== null && item.id !== undefined).map((item) => ({ ...item, id: String(item.id) })).filter((item, index, values) => values.findIndex((value) => value.id === item.id && value.language === item.language) === index);
}

function paginationInfo(json, page, itemCount) {
  const meta = json?.meta ?? json?.pagination ?? json?.paging ?? {};
  const lastPage = Number(meta.last_page ?? meta.lastPage ?? meta.total_pages ?? meta.totalPages ?? 0);
  const currentPage = Number(meta.current_page ?? meta.currentPage ?? page);
  const total = Number(meta.total ?? meta.count ?? 0);
  return { currentPage, lastPage, total, hasMore: lastPage > currentPage || (lastPage === 0 && itemCount > 0) };
}

function mapHadeethRecords(json, source, language, categoryId) {
  return unwrapList(json).map((record) => normalizeRecord({ identifier: record.id, title: record.title, language: record.language ?? language, itemUrl: `https://hadeethenc.com/api/v1/hadeeths/one/?id=${encodeURIComponent(record.id)}&language=${encodeURIComponent(record.language ?? language)}`, rightsUrl: 'https://hadeethenc-content.islamcontent.com/en/developers_api', rightsStatus: 'publisher-declared', method: 'hadeethenc-developer-api-v1-full-discovery', categoryId }, source));
}

async function discoverHadeethEnc(source, options = {}) {
  const discovery = source.connector.discovery;
  if (!discovery) throw new Error(`Source ${source.id} has no discovery contract`);
  const started = Date.now(); const telemetry = []; const allRecords = [];
  const languagesResponse = await fetchJsonWithRetry(discovery.languagesUrl, { ...options, timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS, maxRetries: discovery.maxRetries, retryStatuses: discovery.retryStatuses });
  let languages = extractLanguages(languagesResponse.json);
  if (options.language) languages = languages.filter((language) => language === String(options.language));
  if (!languages.length) languages = [discovery.defaultLanguage];

  for (const language of languages) {
    const categoryUrl = withQuery(discovery.categoriesUrl, { language }); let categories = [];
    try {
      const categoriesResponse = await fetchJsonWithRetry(categoryUrl, { ...options, maxRetries: discovery.maxRetries, retryStatuses: discovery.retryStatuses });
      categories = extractCategories(categoriesResponse.json);
      if (!categories.length) {
        const rootsUrl = withQuery(discovery.rootsUrl, { language });
        const rootsResponse = await fetchJsonWithRetry(rootsUrl, { ...options, maxRetries: discovery.maxRetries, retryStatuses: discovery.retryStatuses });
        categories = extractCategories(rootsResponse.json);
      }
      categories = categories.filter((category, index, values) => values.findIndex((value) => value.id === category.id) === index);
    } catch (error) { telemetry.push({ language, stage: 'categories', status: 'error', error: error.message }); continue; }

    for (const category of categories) {
      let page = 1; let pagesRead = 0;
      while (true) {
        const listUrl = withQuery(discovery.hadithUrl, { language, category_id: category.id, page, per_page: options.pageSize ?? discovery.pageSize });
        try {
          const response = await fetchJsonWithRetry(listUrl, { ...options, maxRetries: discovery.maxRetries, retryStatuses: discovery.retryStatuses });
          const records = mapHadeethRecords(response.json, source, language, category.id); allRecords.push(...records); pagesRead += 1;
          const pagination = paginationInfo(response.json, page, records.length);
          telemetry.push({ language, categoryId: category.id, categoryTitle: category.title, page, status: 'success', records: records.length, pagination });
          if (!pagination.hasMore || records.length === 0) break;
          if (pagination.lastPage > 0 && page >= pagination.lastPage) break;
          page += 1;
        } catch (error) { telemetry.push({ language, categoryId: category.id, categoryTitle: category.title, page, status: 'error', error: error.message }); break; }
      }
      if (options.onProgress) options.onProgress({ sourceId: source.id, language, categoryId: category.id, pagesRead, recordsFound: allRecords.length });
    }
  }

  const deduped = new Map();
  for (const record of allRecords) { const key = `${record.language ?? ''}:${record.identifier ?? record.itemUrl}`; if (!deduped.has(key)) deduped.set(key, record); }
  return { sourceId: source.id, strategy: discovery.strategy, languagesChecked: languages.length, recordsFound: deduped.size, records: [...deduped.values()], telemetry, elapsedMs: Date.now() - started };
}

export async function searchConnector(source, query, options = {}) {
  if (!source?.enabled) return [];
  if (source.id === 'hadeethenc-api' && options.deepDiscovery) {
    const result = await discoverHadeethEnc(source, options);
    return query ? result.records.filter((record) => `${record.title ?? ''}`.toLowerCase().includes(String(query).toLowerCase())) : result.records;
  }
  switch (source.connector.kind) {
    case 'rest-json': return restSearch(source, query, options);
    case 'rest-json-keyed-path': return keyedPathSearch(source, query, options);
    case 'rest-json-catalog': return catalogSearch(source, query, options);
    case 'iiif': return iiifSearch(source, query, options);
    case 'oai-pmh': return oaiIdentify(source, options);
    case 'sru': return restSearch(source, query, options);
    case 'web-discovery': return [];
    default: throw new Error(`Unsupported connector kind: ${source.connector.kind}`);
  }
}

export async function discoverConnector(source, options = {}) {
  if (!source?.enabled) return { sourceId: source?.id ?? null, records: [], telemetry: [], recordsFound: 0 };
  if (source.id === 'hadeethenc-api') return discoverHadeethEnc(source, options);
  throw new Error(`No full discovery adapter for source ${source.id}`);
}

export async function probeConnector(source, options = {}) {
  const started = Date.now();
  try {
    if (source.connector.kind === 'web-discovery') return { sourceId: source.id, status: 'configured', elapsedMs: Date.now() - started };
    if (source.connector.requiresEnv && !process.env[source.connector.requiresEnv]) return { sourceId: source.id, status: 'configured', reason: `missing runtime secret ${source.connector.requiresEnv}`, elapsedMs: Date.now() - started };
    const probeQuery = source.id === 'hadeethenc-api' ? { probe: true } : 'test';
    await searchConnector(source, probeQuery, { ...options, timeoutMs: options.timeoutMs ?? 10_000 });
    return { sourceId: source.id, status: 'healthy', elapsedMs: Date.now() - started };
  } catch (error) { return { sourceId: source.id, status: 'degraded', elapsedMs: Date.now() - started, error: error.message }; }
}

export function createConnectorManifest(sources) {
  return sources.map((source) => ({ id: source.id, name: source.name, enabled: source.enabled !== false, kind: source.connector.kind, acquisition: source.acquisition ?? 'metadata-only', rightsPolicy: source.rightsPolicy ?? 'unknown-blocked', endpoints: [ ...(source.connector.endpoint ? [source.connector.endpoint] : []), ...(source.connector.searchUrl ? [source.connector.searchUrl] : []), ...(source.connector.discovery ? [source.connector.discovery.languagesUrl, source.connector.discovery.categoriesUrl, source.connector.discovery.rootsUrl, source.connector.discovery.hadithUrl, source.connector.discovery.detailUrl].filter(Boolean) : []), ...(source.connector.endpointTemplate ? [source.connector.endpointTemplate] : []) ], discoveryStrategy: source.connector.discovery?.strategy ?? null }));
}
