import test from 'node:test';
import assert from 'node:assert/strict';
import { createFreeLlmDiscoveryRegistry } from '../src/freellm-discovery-registry.js';

test('pins the canonical source to freellm.net', () => {
  const registry = createFreeLlmDiscoveryRegistry({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => '<html><h1>Directory of Free LLM APIs</h1></html>'
    })
  });
  assert.equal(registry.sourceUrl, 'https://freellm.net/');
  assert.equal(registry.modelsUrl, 'https://freellm.net/models/');
});

test('rejects non-canonical source hosts', () => {
  assert.throws(
    () => createFreeLlmDiscoveryRegistry({ sourceUrl: 'https://example.com/' }),
    /freellm\.net/
  );
  assert.throws(
    () => createFreeLlmDiscoveryRegistry({ modelsUrl: 'https://example.com/models/' }),
    /freellm\.net/
  );
});

test('health-checks the real directory marker without storing provider keys', async () => {
  let requested;
  const registry = createFreeLlmDiscoveryRegistry({
    fetchImpl: async (url, options) => {
      requested = { url, options };
      return {
        ok: true,
        status: 200,
        text: async () => '<html>Directory of Free LLM APIs</html>'
      };
    }
  });

  const result = await registry.healthCheck();
  assert.equal(result.ok, true);
  assert.equal(requested.url, 'https://freellm.net/models/');
  assert.equal(requested.options.headers.accept.includes('text/html'), true);
});

test('fails closed when the directory shape changes', async () => {
  const registry = createFreeLlmDiscoveryRegistry({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => '<html>unexpected page</html>'
    })
  });

  await assert.rejects(
    () => registry.healthCheck(),
    /expected directory marker/
  );
});

test('keeps weight discovery separate from weight authority', () => {
  const registry = createFreeLlmDiscoveryRegistry();
  const snapshot = registry.snapshot([{
    provider: 'Example',
    modelId: 'example/free',
    openWeights: true,
    weightsUrl: 'https://huggingface.co/example/free'
  }]);
  assert.equal(snapshot.models[0].openWeights, true);
  assert.equal(snapshot.models[0].weightsUrl, 'https://huggingface.co/example/free');
  assert.equal(snapshot.sourceUrl, 'https://freellm.net/');
});
