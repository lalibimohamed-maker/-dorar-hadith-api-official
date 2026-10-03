const CANONICAL_HOST = 'freellm.net';
const REQUIRED_SOURCE = 'https://freellm.net/';
const REQUIRED_MODELS = 'https://freellm.net/models/';
const REQUIRED_LLMS = 'https://freellm.net/llms.txt';
const REQUIRED_STATUS = 'https://freellm.net/free-llm-api-status';

function canonicalizeUrl(value, label, expectedPath) {
  if (typeof value !== 'string') {
    throw new TypeError(label + ' must be a URL');
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError(label + ' must be a valid URL');
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== CANONICAL_HOST) {
    throw new TypeError(label + ' must remain on freellm.net');
  }
  if (parsed.pathname !== expectedPath) {
    throw new TypeError(label + ' must use the canonical freellm.net path');
  }

  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

function assertUrl(value, label) {
  if (typeof value !== 'string' || !value.startsWith('https://')) {
    throw new TypeError(label + ' must be an HTTPS URL');
  }
  return value;
}

function normalizeModel(model = {}) {
  if (!model.provider || !model.modelId) {
    throw new TypeError('provider and modelId are required');
  }
  return Object.freeze({
    provider: String(model.provider),
    modelId: String(model.modelId),
    status: model.status ?? 'unknown',
    verification: model.verification ?? null,
    contextWindow: model.contextWindow ?? null,
    modalities: Array.isArray(model.modalities) ? [...model.modalities] : [],
    rateLimit: model.rateLimit ?? null,
    freeTier: model.freeTier ?? null,
    noCreditCard: model.noCreditCard ?? null,
    noPhoneVerification: model.noPhoneVerification ?? null,
    openWeights: model.openWeights === true,
    weightsUrl: model.weightsUrl ? assertUrl(model.weightsUrl, 'weightsUrl') : null
  });
}

export function createFreeLlmDiscoveryRegistry({
  sourceUrl = REQUIRED_SOURCE,
  modelsUrl = REQUIRED_MODELS,
  agentIndexUrl = REQUIRED_LLMS,
  statusUrl = REQUIRED_STATUS,
  fetchImpl = globalThis.fetch
} = {}) {
  sourceUrl = canonicalizeUrl(sourceUrl, 'sourceUrl', '/');
  modelsUrl = canonicalizeUrl(modelsUrl, 'modelsUrl', '/models/');
  agentIndexUrl = canonicalizeUrl(agentIndexUrl, 'agentIndexUrl', '/llms.txt');
  statusUrl = canonicalizeUrl(statusUrl, 'statusUrl', '/free-llm-api-status');

  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is unavailable');
  }

  async function getText(url, expectedMarker, label) {
    const response = await fetchImpl(url, {
      headers: { accept: 'text/html,application/xhtml+xml,text/plain' }
    });
    if (!response || !response.ok) {
      throw new Error(label + ' unavailable: ' + (response?.status ?? 'unknown'));
    }
    const body = await response.text();
    if (!expectedMarker.test(body)) {
      throw new Error(label + ' did not contain the expected marker');
    }
    return Object.freeze({
      url,
      status: response.status,
      bytes: Buffer.byteLength(body, 'utf8')
    });
  }

  async function healthCheck() {
    const [directory, agentIndex, status] = await Promise.all([
      getText(modelsUrl, /Directory of Free LLM APIs/i, 'freellm.net models page'),
      getText(agentIndexUrl, /# FreeLLM Hub/i, 'freellm.net llms.txt'),
      getText(statusUrl, /Free LLM API Status/i, 'freellm.net status page')
    ]);

    return Object.freeze({
      ok: true,
      sourceUrl,
      modelsUrl,
      agentIndexUrl,
      statusUrl,
      retrieved: new Date().toISOString(),
      sources: Object.freeze({ directory, agentIndex, status })
    });
  }

  function snapshot(models = []) {
    if (!Array.isArray(models)) throw new TypeError('models must be an array');
    return Object.freeze({
      schema: 'dinullah.freellm-discovery-snapshot.v2',
      sourceUrl,
      modelsUrl,
      agentIndexUrl,
      statusUrl,
      models: models.map(normalizeModel),
      generatedAt: new Date().toISOString()
    });
  }

  return Object.freeze({
    sourceUrl,
    modelsUrl,
    agentIndexUrl,
    statusUrl,
    healthCheck,
    normalizeModel,
    snapshot
  });
}
