const REQUIRED_SOURCE = 'https://freellm.net/';
const REQUIRED_MODELS = 'https://freellm.net/models/';

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
  fetchImpl = globalThis.fetch
} = {}) {
  assertUrl(sourceUrl, 'sourceUrl');
  assertUrl(modelsUrl, 'modelsUrl');

  if (!sourceUrl.startsWith(REQUIRED_SOURCE)) {
    throw new TypeError('freellm sourceUrl must remain on freellm.net');
  }
  if (!modelsUrl.startsWith(REQUIRED_SOURCE)) {
    throw new TypeError('freellm modelsUrl must remain on freellm.net');
  }

  async function healthCheck() {
    if (typeof fetchImpl !== 'function') {
      throw new Error('fetch is unavailable');
    }
    const response = await fetchImpl(modelsUrl, {
      headers: { accept: 'text/html,application/xhtml+xml' }
    });
    if (!response || !response.ok) {
      throw new Error('freellm.net models endpoint unavailable: ' + (response?.status ?? 'unknown'));
    }
    const html = await response.text();
    if (!/Directory of Free LLM APIs/i.test(html)) {
      throw new Error('freellm.net models page did not contain the expected directory marker');
    }
    return Object.freeze({
      ok: true,
      sourceUrl,
      modelsUrl,
      retrieved: new Date().toISOString(),
      bytes: Buffer.byteLength(html, 'utf8')
    });
  }

  function snapshot(models = []) {
    if (!Array.isArray(models)) throw new TypeError('models must be an array');
    return Object.freeze({
      schema: 'dinullah.freellm-discovery-snapshot.v1',
      sourceUrl,
      modelsUrl,
      models: models.map(normalizeModel),
      generatedAt: new Date().toISOString()
    });
  }

  return Object.freeze({
    sourceUrl,
    modelsUrl,
    healthCheck,
    normalizeModel,
    snapshot
  });
}
