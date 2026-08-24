import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverBookSources, listBookSourceConnectors, registerBookSourceConnector, selectBestCandidate } from '../src/book-source-connectors.js';

registerBookSourceConnector({
  id: 'test-source',
  name: 'Test Source',
  capabilities: ['metadata', 'reader-link'],
  discover: async () => [{ id: 'a', url: 'https://example.invalid/a', title: 'A' }],
});

test('connectors are discoverable without granting redistribution rights', async () => {
  assert.ok(listBookSourceConnectors().some((x) => x.id === 'test-source'));
  const results = await discoverBookSources('example', ['test-source']);
  assert.equal(results[0].rightsStatus, 'rights-unclear');
  assert.equal(results[0].redistributionAllowed, false);
});

test('candidate selection prefers explicit redistribution permission', () => {
  const selected = selectBestCandidate([
    { connector: 'a', url: 'https://example.invalid/a', redistributionAllowed: false },
    { connector: 'b', url: 'https://example.invalid/b', redistributionAllowed: true },
  ]);
  assert.equal(selected.connector, 'b');
});
