import test from 'node:test';
import assert from 'node:assert/strict';
import registry from '../config/rechercher-web-discovery-priority.json' with { type: 'json' };

test('global multilingual web-discovery registry is complete and isolated', () => {
  assert.equal(registry.schema, 'rechercher/web-discovery-priority/v1');
  assert.equal(registry.policy.corpus_isolation, true);
  assert.equal(registry.policy.rights_required_for_download, true);
  assert.equal(registry.sources.length, 18);
  const ids = registry.sources.map((source) => source.id);
  const urls = registry.sources.map((source) => source.url);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(urls).size, urls.length);
  for (const source of registry.sources) {
    assert.ok(source.id && source.name && source.url && source.languages && source.role);
    assert.equal(source.enabled, true);
    assert.equal(new URL(source.url).protocol, 'https:');
  }
});
