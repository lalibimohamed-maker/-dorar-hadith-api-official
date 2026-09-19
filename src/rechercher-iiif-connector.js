const DEFAULT_HEADERS = Object.freeze({ accept: 'application/ld+json, application/json;q=0.9' });

function requireUrl(value, field) {
  if (!value || typeof value !== 'string') throw new TypeError(`${field} is required`);
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new TypeError(`${field} must use HTTPS`);
  return url.toString();
}

async function getJson(url, { fetchImpl = globalThis.fetch, headers = {} } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required');
  const response = await fetchImpl(url, { method: 'GET', headers: { ...DEFAULT_HEADERS, ...headers } });
  if (!response || !response.ok) throw new Error(`IIIF request failed: ${response?.status ?? 'unknown'}`);
  return response.json();
}

function normalizeResource(resource = {}, fallbackType = 'Dataset') {
  if (!resource?.id) return null;
  return {
    id: resource.id,
    type: resource.type || fallbackType,
    format: resource.format || null,
    language: resource.language || null,
    duration: resource.duration || null,
  };
}

export function parseIiifManifest(manifest = {}) {
  if (manifest.type !== 'Manifest' || !manifest.id) throw new TypeError('A valid IIIF Presentation 3 Manifest is required');
  const canvases = Array.isArray(manifest.items) ? manifest.items.map((canvas, index) => ({
    id: canvas.id || null,
    type: canvas.type || 'Canvas',
    index,
    label: canvas.label || null,
    width: canvas.width || null,
    height: canvas.height || null,
    duration: canvas.duration || null,
    content: (canvas.items || []).flatMap(page => (page.items || []).map(annotation => normalizeResource(annotation.body, 'Image')).filter(Boolean)),
  })).filter(canvas => canvas.id) : [];
  const renderings = (manifest.rendering || []).map(item => normalizeResource(item, 'Text')).filter(Boolean);
  return {
    manifestId: manifest.id,
    type: 'Manifest',
    label: manifest.label || null,
    canvases,
    renderings,
    homepage: (manifest.homepage || []).map(item => normalizeResource(item, 'Text')).filter(Boolean),
    seeAlso: (manifest.seeAlso || []).map(item => normalizeResource(item, 'Dataset')).filter(Boolean),
  };
}

export function extractPdfRenderings(manifestModel) {
  return (manifestModel?.renderings || []).filter(item => item.format === 'application/pdf' || /\.pdf(?:$|[?#])/i.test(item.id));
}

export async function fetchIiifManifest(manifestUrl, options = {}) {
  const url = requireUrl(manifestUrl, 'manifestUrl');
  const raw = await getJson(url, options);
  const model = parseIiifManifest(raw);
  return { url, raw, model, pdfRenderings: extractPdfRenderings(model) };
}

export async function searchIiifContent(searchUrl, options = {}) {
  const url = requireUrl(searchUrl, 'searchUrl');
  const raw = await getJson(url, options);
  const hits = Array.isArray(raw?.items) ? raw.items.map((item, index) => ({
    id: item.id || null,
    index,
    type: item.type || 'AnnotationPage',
    motivation: item.motivation || null,
    body: item.body || null,
    target: item.target || null,
  })) : [];
  return { url, raw, hits };
}

export function createIiifAcquisitionCandidate(manifestResult, { sourceId = null, rightsStatus = 'UNKNOWN', provenance = null } = {}) {
  if (!manifestResult?.model?.manifestId) throw new TypeError('manifestResult is required');
  const pdf = manifestResult.pdfRenderings[0] || null;
  return {
    sourceId,
    manifestId: manifestResult.model.manifestId,
    candidateType: pdf ? 'PDF_RENDERING' : 'IIIF_MANIFEST',
    url: pdf?.id || manifestResult.url,
    format: pdf?.format || null,
    rightsStatus,
    provenance,
    acquisitionIndependentFromPublication: true,
    publishable: rightsStatus === 'ALLOWED',
  };
}

export function createIiifConnector({ fetchImpl = globalThis.fetch, headers = {} } = {}) {
  return Object.freeze({
    version: '1.0.0',
    fetchManifest: url => fetchIiifManifest(url, { fetchImpl, headers }),
    searchContent: url => searchIiifContent(url, { fetchImpl, headers }),
    createAcquisitionCandidate: (result, options) => createIiifAcquisitionCandidate(result, options),
    policy: Object.freeze({ httpsOnly: true, readOnly: true, noAccessControlBypass: true, acquisitionIndependentFromPublication: true }),
  });
}
