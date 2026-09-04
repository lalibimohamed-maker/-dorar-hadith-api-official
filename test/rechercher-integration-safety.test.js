import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAlternativeSource } from '../src/rechercher-alternative-policy.js';

test('a discovered candidate without verified rights cannot unlock download', () => {
  const result = resolveAlternativeSource({
    id: 'protected-book', rightsDecision: 'read-only',
    alternativeSources: [{ sourceUrl: 'https://archive.org/details/item', downloadUrl: 'https://archive.org/download/item/book.pdf', rightsVerified: false, rightsDecision: 'unclear' }]
  });
  assert.equal(result.outcome, 'read-only-original');
  assert.equal(result.selected, null);
});
