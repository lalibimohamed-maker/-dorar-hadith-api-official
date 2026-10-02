import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLocalConsumerInferenceRuntime,
  createLocalSessionPolicy
} from '../src/local-consumer-inference-runtime.js';

test('selects verified WebGPU backend first', async () => {
  const events = [];
  const runtime = createLocalConsumerInferenceRuntime({
    mode: 'auto',
    capabilities: { webgpu: true, wasm: true },
    preferredBackends: ['webgpu', 'wasm'],
    backendLoaders: {
      webgpu: async () => ({ run: async input => ({ backend: 'webgpu', input }) }),
      wasm: async () => ({ run: async input => ({ backend: 'wasm', input }) })
    },
    onEvent: event => events.push(event)
  });

  const result = await runtime.initialize();
  assert.equal(result.ready, true);
  assert.equal(result.backend, 'webgpu');
  assert.equal(typeof result.runtime.run, 'function');
  assert.equal(events.at(-1).type, 'ready');
});

test('falls back locally from WebGPU to WASM without network promotion', async () => {
  const runtime = createLocalConsumerInferenceRuntime({
    mode: 'auto',
    capabilities: { webgpu: false, wasm: true },
    preferredBackends: ['webgpu', 'wasm'],
    backendLoaders: {
      wasm: async () => ({ run: async input => ({ backend: 'wasm', input }) })
    }
  });

  const result = await runtime.initialize();
  assert.equal(result.ready, true);
  assert.equal(result.backend, 'wasm');

  const policy = createLocalSessionPolicy({ mode: 'auto', networkAvailable: true });
  assert.equal(policy.remoteAllowed, true);
  assert.equal(policy.silentRemoteFallback, false);
});

test('offline_only stays unavailable when no verified local backend exists', async () => {
  const runtime = createLocalConsumerInferenceRuntime({
    mode: 'offline_only',
    capabilities: { webgpu: false, wasm: false, native: false }
  });

  const result = await runtime.initialize();
  assert.equal(result.ready, false);
  assert.equal(result.reason, 'no-verified-local-backend');
});

test('online_only explicitly forbids local inference', async () => {
  const runtime = createLocalConsumerInferenceRuntime({
    mode: 'online_only',
    capabilities: { wasm: true },
    backendLoaders: { wasm: async () => ({ run() {} }) }
  });

  const result = await runtime.initialize();
  assert.equal(result.ready, false);
  assert.equal(result.reason, 'online_only-forbids-local-inference');
});
