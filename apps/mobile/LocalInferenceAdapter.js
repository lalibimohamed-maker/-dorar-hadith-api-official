import { createLocalConsumerInferenceRuntime } from '../../src/local-consumer-inference-runtime.js';

export function createMobileLocalInferenceAdapter({
  mode = 'auto',
  capabilities = {},
  verifiedBackends = [],
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
    verifiedBackends,
    preferredBackends: ['webgpu', 'native', 'wasm'],
    backendLoaders,
    onEvent
  });

  return Object.freeze({
    runtime,
    async initialize() {
      const result = await runtime.initialize();
      if (!result.ready) {
        return {
          ready: false,
          mode,
          reason: result.reason,
          backend: null,
          failures: result.failures || []
        };
      }
      return {
        ready: true,
        mode,
        backend: result.backend,
        runtime: result.runtime,
        failures: result.failures || []
      };
    }
  });
}
