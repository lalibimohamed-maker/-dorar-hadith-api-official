import { createLocalConsumerInferenceRuntime } from '../../src/local-consumer-inference-runtime.js';

export function createMobileLocalInferenceAdapter({
  mode = 'auto',
  capabilities = {},
  webgpuLoader,
  wasmLoader,
  nativeLoader,
  onEvent
} = {}) {
  const backendLoaders = {
    ...(webgpuLoader ? { webgpu: webgpuLoader } : {}),
    ...(wasmLoader ? { wasm: wasmLoader } : {}),
    ...(nativeLoader ? { native: nativeLoader } : {})
  };

  const runtime = createLocalConsumerInferenceRuntime({
    mode,
    capabilities,
    preferredBackends: ['webgpu', 'native', 'wasm'],
    backendLoaders,
    onEvent
  });

  return Object.freeze({
    runtime,
    async initialize() {
      const result = await runtime.initialize();
      if (!result.ready) return { ready: false, mode, reason: result.reason, backend: null };
      return { ready: true, mode, backend: result.backend, runtime: result.runtime };
    }
  });
}
