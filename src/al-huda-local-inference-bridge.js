import { createLocalConsumerInferenceRuntime } from './local-consumer-inference-runtime.js';

export function createAlHudaLocalReasoningBridge({
  mode = 'auto',
  capabilities = {},
  preferredBackends = ['webgpu', 'native', 'wasm'],
  backendLoaders = {},
  verifiedBackends = [],
  onEvent = () => {},
} = {}) {
  const local = createLocalConsumerInferenceRuntime({
    mode,
    capabilities,
    preferredBackends,
    backendLoaders,
    verifiedBackends,
    onEvent,
  });

  async function initialize() {
    const result = await local.initialize();
    if (!result.ready) return Object.freeze({ ready: false, mode, reason: result.reason, failures: result.failures || [] });
    return Object.freeze({ ready: true, mode, backend: result.backend, runtime: result.runtime });
  }

  async function reason({ text, language = null, context = null } = {}) {
    if (!text || !String(text).trim()) throw new TypeError('text is required');
    const result = await local.initialize();
    if (!result.ready) throw new Error('Al-Huda local reasoning is unavailable: ' + result.reason);
    const output = await result.runtime.run({
      task: 'al-huda-reasoning',
      text: String(text),
      language,
      context,
    });
    return Object.freeze({
      text: output?.text ?? output,
      backend: result.backend,
      local: true,
      assistant: 'Al-Huda',
    });
  }

  return Object.freeze({
    assistant: 'Al-Huda',
    localFirst: true,
    remoteImplicit: false,
    runtime: local,
    initialize,
    reason,
  });
}
