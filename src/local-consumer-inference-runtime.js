const MODES = new Set(['offline_only', 'auto', 'online_only']);
const BACKENDS = new Set(['webgpu', 'wasm', 'native']);

function assertMode(mode) {
  if (!MODES.has(mode)) throw new TypeError('invalid local inference mode: ' + mode);
}

function normalizeCapabilities(capabilities = {}) {
  return Object.freeze({
    webgpu: capabilities.webgpu === true,
    wasm: capabilities.wasm !== false,
    native: capabilities.native === true
  });
}

/**
 * Platform-neutral local inference admission/runtime selector.
 *
 * No downloads, remote inference, paid fallback, or Corpus writes happen here.
 * The caller supplies already-provisioned local backends.
 */
export function createLocalConsumerInferenceRuntime({
  mode = 'auto',
  capabilities = {},
  preferredBackends = ['webgpu', 'wasm', 'native'],
  backendLoaders = {},
  onEvent = () => {}
} = {}) {
  assertMode(mode);
  const caps = normalizeCapabilities(capabilities);
  const ordered = [...preferredBackends].filter((backend, index, list) =>
    BACKENDS.has(backend) && list.indexOf(backend) === index
  );

  function emit(type, detail = {}) {
    onEvent({ type, ...detail });
  }

  function admissibleBackends() {
    return ordered.filter(backend => caps[backend] && typeof backendLoaders[backend] === 'function');
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

    const backend = selection.backend;
    emit('loading', { backend, candidates: selection.candidates });
    const runtime = await backendLoaders[backend]();
    if (!runtime || typeof runtime.run !== 'function') {
      emit('error', { backend, reason: 'backend-loader-returned-invalid-runtime' });
      throw new TypeError('invalid local inference runtime for backend: ' + backend);
    }
    emit('ready', { backend });
    return Object.freeze({ ready: true, mode, backend, candidates: selection.candidates, runtime });
  }

  return Object.freeze({ mode, capabilities: caps, selectBackend, initialize });
}

export function createLocalSessionPolicy({ mode = 'auto', networkAvailable = true } = {}) {
  assertMode(mode);
  const localAllowed = mode !== 'online_only';
  const remoteAllowed = mode !== 'offline_only' && networkAvailable === true;
  return Object.freeze({
    mode,
    localAllowed,
    remoteAllowed,
    silentRemoteFallback: false
  });
}
