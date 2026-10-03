import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalConsumerInferenceRuntime, createLocalSessionPolicy } from '../src/local-consumer-inference-runtime.js';
import { createAlHudaLocalReasoningBridge } from '../src/al-huda-local-inference-bridge.js';

const verifiedWasm = {
  capabilities: { webgpu: false, wasm: true, native: false },
  verifiedBackends: ['wasm'],
  backendLoaders: {
    wasm: async () => ({ run: async input => ({ text: 'محلي: ' + input.text, backend: 'wasm' }) })
  }
};

test('selects verified WebGPU backend first', async () => {
  const events = [];
  const runtime = createLocalConsumerInferenceRuntime({
    mode: 'auto',
    capabilities: { webgpu: true, wasm: true },
    verifiedBackends: ['webgpu', 'wasm'],
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
    verifiedBackends: ['wasm'],
    preferredBackends: ['webgpu', 'wasm'],
    backendLoaders: verifiedWasm.backendLoaders
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
    capabilities: { webgpu: false, wasm: true, native: false },
    verifiedBackends: []
  });
  const result = await runtime.initialize();
  assert.equal(result.ready, false);
  assert.equal(result.reason, 'no-verified-local-backend');
});

test('online_only explicitly forbids local inference', async () => {
  const runtime = createLocalConsumerInferenceRuntime({
    mode: 'online_only',
    capabilities: { wasm: true },
    verifiedBackends: ['wasm'],
    backendLoaders: { wasm: async () => ({ run() {} }) }
  });
  const result = await runtime.initialize();
  assert.equal(result.ready, false);
  assert.equal(result.reason, 'online_only-forbids-local-inference');
});

test('Al-Huda reasoning bridge uses the local consumer runtime', async () => {
  const bridge = createAlHudaLocalReasoningBridge({ mode: 'offline_only', ...verifiedWasm });
  const result = await bridge.reason({ text: 'ما معنى التوحيد؟', language: 'ar' });
  assert.equal(result.local, true);
  assert.equal(result.assistant, 'Al-Huda');
  assert.equal(result.backend, 'wasm');
  assert.match(result.text, /^محلي:/);
});

test('Al-Huda bridge fails closed when no verified local backend exists', async () => {
  const bridge = createAlHudaLocalReasoningBridge({
    mode: 'offline_only',
    capabilities: { wasm: true },
    verifiedBackends: []
  });
  await assert.rejects(() => bridge.reason({ text: 'اختبار' }), /local reasoning is unavailable/);
});
