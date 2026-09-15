const HTTPS = 'https:';

function httpsUrl(value, field = 'url') {
  if (!value || typeof value !== 'string') throw new TypeError(`${field} is required`);
  const url = new URL(value);
  if (url.protocol !== HTTPS) throw new TypeError(`${field} must use HTTPS`);
  return url.toString();
}

async function getJson(url, { fetchImpl = globalThis.fetch, headers = {} } = {}) {
  const target = httpsUrl(url);
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required');
  const response = await fetchImpl(target, { method: 'GET', headers: { accept: 'application/json, application/ld+json;q=0.9', ...headers } });
  if (!response?.ok) throw new Error(`connector request failed: ${response?.status ?? 'unknown'} ${target}`);
  return response.json();
}

function candidate({ adapter, url, sourceId = null, workId = null, format = null, rightsStatus = 'UNKNOWN', provenance = null, metadata = {} }) {
  return Object.freeze({ adapter, url, sourceId, workId, format, rightsStatus, provenance, metadata, acquisitionIndependentFromPublication: true, publishable: rightsStatus === 'ALLOWED' });
}

export async function openIiif(url, options = {}) {
  const { fetchIiifManifest } = await import('./rechercher-iiif-connector.js');
  return fetchIiifManifest(url, options);
}

export async function openOpenItiKitab({ owner = 'OpenITI', repo = 'OpenITI', path = '', ref = 'master', githubApiBase = 'https://api.github.com', fetchImpl = globalThis.fetch } = {}) {
  const encodedPath = path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  const url = new URL(`${githubApiBase.replace(/\/$/, '')}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`);
  if (ref) url.searchParams.set('ref', ref);
  return getJson(url.toString(), { fetchImpl, headers: { accept: 'application/vnd.github+json' } });
}

export async function searchOpenAlex(query, { mailto = null, fetchImpl = globalThis.fetch } = {}) {
  const url = new URL('https://api.openalex.org/works'); url.searchParams.set('search', query); url.searchParams.set('per-page', '25'); if (mailto) url.searchParams.set('mailto', mailto); return getJson(url.toString(), { fetchImpl });
}
export async function searchCrossref(query, { mailto = null, fetchImpl = globalThis.fetch } = {}) {
  const url = new URL('https://api.crossref.org/works'); url.searchParams.set('query.bibliographic', query); url.searchParams.set('rows', '25'); if (mailto) url.searchParams.set('mailto', mailto); return getJson(url.toString(), { fetchImpl });
}
export async function searchDataCite(query, { fetchImpl = globalThis.fetch } = {}) {
  const url = new URL('https://api.datacite.org/dois'); url.searchParams.set('query', query); url.searchParams.set('page[size]', '25'); return getJson(url.toString(), { fetchImpl });
}
export async function searchLibraryCatalog({ baseUrl, query, fetchImpl = globalThis.fetch } = {}) {
  if (!baseUrl || !query) throw new TypeError('baseUrl and query are required'); const url = new URL(baseUrl); url.searchParams.set('q', query); return getJson(url.toString(), { fetchImpl });
}
export async function searchInternetArchive(query, { fetchImpl = globalThis.fetch } = {}) {
  const url = new URL('https://archive.org/advancedsearch.php'); url.searchParams.set('q', query); for (const field of ['identifier','title','creator','format','rights','publicdate']) url.searchParams.append('fl[]', field); url.searchParams.set('rows', '50'); url.searchParams.set('page', '1'); url.searchParams.set('output', 'json'); return getJson(url.toString(), { fetchImpl });
}
export async function searchOpenRepository({ baseUrl, query, fetchImpl = globalThis.fetch } = {}) {
  if (!baseUrl || !query) throw new TypeError('baseUrl and query are required'); const url = new URL(baseUrl); url.searchParams.set('q', query); return getJson(url.toString(), { fetchImpl });
}
export async function searchIslamicSpecialized({ endpoint, query, fetchImpl = globalThis.fetch } = {}) {
  if (!endpoint || !query) throw new TypeError('endpoint and query are required'); const url = new URL(endpoint); url.searchParams.set('q', query); return getJson(url.toString(), { fetchImpl });
}
export async function searchMedia({ endpoint, query, fetchImpl = globalThis.fetch } = {}) {
  if (!endpoint || !query) throw new TypeError('endpoint and query are required'); const url = new URL(endpoint); url.searchParams.set('q', query); return getJson(url.toString(), { fetchImpl });
}
export function createFutureSourceConnector({ baseUrl, fetchImpl = globalThis.fetch } = {}) { return Object.freeze({ discover: query => searchOpenRepository({ baseUrl, query, fetchImpl }), policy: { readOnly: true, httpsOnly: true, acquisitionIndependentFromPublication: true } }); }
export function createWorldwideConnectorSuite({ fetchImpl = globalThis.fetch, headers = {} } = {}) {
  return Object.freeze({ version: '1.0.0', order: Object.freeze(['IIIF','OPENITI_KITAB','LIBRARIES_MANUSCRIPTS','OPENALEX_CROSSREF_DATACITE','ARCHIVES','OPEN_REPOSITORIES','ISLAMIC_SPECIALIZED','AUDIO_VIDEO','FUTURE_SOURCES']), policy: Object.freeze({ readOnlyDiscovery: true, httpsOnly: true, noAccessControlBypass: true, acquisitionIndependentFromPublication: true, rightsDoNotBlockLawfulAcquisition: true, publicationRequiresRights: true }), iiif: { open: url => openIiif(url, { fetchImpl, headers }) }, openitiKitab: { open: options => openOpenItiKitab({ ...options, fetchImpl }) }, scholarly: { openAlex: q => searchOpenAlex(q, { fetchImpl }), crossref: q => searchCrossref(q, { fetchImpl }), dataCite: q => searchDataCite(q, { fetchImpl }) }, libraries: { search: options => searchLibraryCatalog({ ...options, fetchImpl }) }, archives: { internetArchive: q => searchInternetArchive(q, { fetchImpl }) }, repositories: { search: options => searchOpenRepository({ ...options, fetchImpl }) }, islamicSpecialized: { search: options => searchIslamicSpecialized({ ...options, fetchImpl }) }, media: { search: options => searchMedia({ ...options, fetchImpl }) }, future: { create: options => createFutureSourceConnector({ ...options, fetchImpl }) }, candidate });
}
