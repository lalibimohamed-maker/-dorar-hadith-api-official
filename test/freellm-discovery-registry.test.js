import test from 'node:test';
import assert from 'node:assert/strict';
import { createFreeLlmDiscoveryRegistry } from '../src/freellm-discovery-registry.js';

test('pins and canonicalizes the FreeLLM source, including tracking URLs', () => {
  const registry = createFreeLlmDiscoveryRegistry({
    sourceUrl: 'https://freellm.net/?utm_source=chatgpt.com',
    modelsUrl: 'https://freellm.net/models/?utm_source=chatgpt.com',
    agentIndexUrl: 'https://freellm.net/llms.txt?utm_source=chatgpt.com',
    statusUrl: 'https://freellm.net/free-llm-api-status?utm_source=chatgpt.com',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => '<html># FreeLLM Hub Directory of Free LLM APIs Free LLM API Status</html>'
    })
  });
  assert.equal(registry.sourceUrl, 'https://freellm.net/');
  assert.equal(registry.modelsUrl, 'https://freellm.net/models/');
  assert.equal(registry.agentIndexUrl, 'https://freellm.net/llms.txt');
  assert.equal(registry.statusUrl, 'https://freellm.net/free-llm-api-status');
});

test('rejects non-canonical source hosts and paths', () => {
  assert.throws(
    () => createFreeLlmDiscoveryRegistry({ sourceUrl: 'https://example.com/' }),
    (error) => String(error?.message).includes('freellm.net')
  );
  assert.throws(
    () => createFreeLlmDiscoveryRegistry({ modelsUrl: 'https://freellm.net/api/models' }),
    (error) => String(error?.message).includes('canonical freellm.net path')
  );
  assert.throws(
    () => createFreeLlmDiscoveryRegistry({ agentIndexUrl: 'https://example.com/llms.txt' }),
    (error) => String(error?.message).includes('freellm.net')
  );
});

test('health-checks directory, agent index and status sources', async () => {
  const requested = [];
  const bodies = {
    'https://freellm.net/models/': '<html>Directory of Free LLM APIs</html>',
    'https://freellm.net/llms.txt': '# FreeLLM Hub',
    'https://freellm.net/free-llm-api-status': '<html>Free LLM API Status</html>'
  };
  const registry = createFreeLlmDiscoveryRegistry({
    fetchImpl: async (url, options) => {
      requested.push({ url, options });
      return {
        ok: true,
        status: 200,
        text: async () => bodies[url]
      };
    }
  });

  const result = await registry.healthCheck();
  assert.equal(result.ok, true);
  assert.deepEqual(requested.map((r) => r.url).sort(), Object.keys(bodies).sort());
  for (const request of requested) {
    assert.equal(request.options.headers.accept.includes('text/html'), true);
  }
});

test('fails closed when any discovery source shape changes', async () => {
  const registry = createFreeLlmDiscoveryRegistry({
    fetchImpl: async (url) => ({
      ok: true,
      status: 200,
      text: async () => (
        url.endsWith('/models/')
          ? '<html>unexpected page</html>'
          : url.endsWith('/llms.txt')
            ? '# FreeLLM Hub'
            : 'Free LLM API Status'
      )
    })
  });

  await assert.rejects(
    () => registry.healthCheck(),
    /did not contain the expected marker/
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
  assert.equal(snapshot.agentIndexUrl, 'https://freellm.net/llms.txt');
  assert.equal(snapshot.statusUrl, 'https://freellm.net/free-llm-api-status');
});
