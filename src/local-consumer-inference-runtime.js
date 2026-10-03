const MODES = new Set(['offline_only', 'auto', 'online_only']);
const BACKENDS = new Set(['webgpu', 'wasm', 'native']);

function assertMode(mode) {
  if (!MODES.has(mode)) throw new TypeError('invalid local inference mode: ' + mode);
}

function normalizeCapabilities(capabilities = {}) {
  return Object.freeze({
    webgpu: capabilities.webgpu === true,
    wasm: capabilities.wasm === true,
    native: capabilities.native === true
  });
}

/**
 * Local inference admission boundary.
 *
 * A backend is admitted only when:
 * 1. the platform capability is explicitly true;
 * 2. a loader is supplied; and
 * 3. the caller explicitly marks the local backend as verified.
 *
 * This module never downloads models, performs remote inference, or writes Corpus data.
 */
export function createLocalConsumerInferenceRuntime({
  mode = 'auto',
  capabilities = {},
  preferredBackends = ['webgpu', 'wasm', 'native'],
  backendLoaders = {},
  verifiedBackends = [],
  onEvent = () => {}
} = {}) {
  assertMode(mode);
  const caps = normalizeCapabilities(capabilities);
  const verified = new Set(verifiedBackends);
  const ordered = [...preferredBackends].filter((backend, index, list) =>
    BACKENDS.has(backend) && list.indexOf(backend) === index
  );

  function emit(type, detail = {}) {
    onEvent({ type, ...detail });
  }

  function admissibleBackends() {
    return ordered.filter(backend =>
      caps[backend] === true &&
      verified.has(backend) &&
      typeof backendLoaders[backend] === 'function'
    );
  }

  function selectBackend() {
    if (mode === 'online_only') {
      return { available: false, reason: 'online_only-forbids-local-inference' };
    }
    const candidates = admissibleBackends();
    if (!candidates.length) {
      return { available: false, reason: 'no-verified-local-backend', candidates: [] };
    }
    return { available: true, backend: candidates[0], candidates };
  }

  async function initialize() {
    const selection = selectBackend();
    if (!selection.available) {
      emit('unavailable', selection);
      return Object.freeze({ ready: false, mode, ...selection });
    }

    const failures = [];
    for (const backend of selection.candidates) {
      emit('loading', { backend, candidates: selection.candidates });
      try {
        const runtime = await backendLoaders[backend]();
        if (!runtime || typeof runtime.run !== 'function') {
          throw new TypeError('backend-loader-returned-invalid-runtime');
        }
        emit('ready', { backend });
        return Object.freeze({
          ready: true,
          mode,
          backend,
          candidates: selection.candidates,
          failures,
          runtime
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        failures.push({ backend, reason });
        emit('backend_failed', { backend, reason });
      }
    }

    emit('error', { reason: 'all-verified-local-backends-failed', failures });
    return Object.freeze({
      ready: false,
      mode,
      reason: 'all-verified-local-backends-failed',
      candidates: selection.candidates,
      failures
    });
  }

  return Object.freeze({ mode, capabilities: caps, verifiedBackends: [...verified], selectBackend, initialize });
}

export function createLocalSessionPolicy({ mode = 'auto', networkAvailable = true } = {}) {
  assertMode(mode);
  return Object.freeze({
    mode,
    localAllowed: mode !== 'online_only',
    remoteAllowed: mode !== 'offline_only' && networkAvailable === true,
    silentRemoteFallback: false
  });
}
