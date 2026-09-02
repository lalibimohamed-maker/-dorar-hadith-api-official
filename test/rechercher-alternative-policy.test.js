import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAlternativeSource, ALTERNATIVE_OUTCOMES } from '../src/rechercher-alternative-policy.js';

test('a rights-cleared alternative replaces a restricted source', () => {
  const result = resolveAlternativeSource({
    id: 'book-1',
    rightsDecision: 'read-only',
    alternativeSources: [
      { sourceUrl: 'https://example.org/restricted', rightsDecision: 'unclear' },
      { sourceUrl: 'https://example.org/open', rightsDecision: 'explicitly-licensed', rightsVerified: true }
    ]
  });
  assert.equal(result.outcome, ALTERNATIVE_OUTCOMES.USE_ALTERNATIVE);
  assert.equal(result.selected.sourceUrl, 'https://example.org/open');
});

test('a restricted source remains readable when alternatives are not rights-cleared', () => {
  const result = resolveAlternativeSource({
    id: 'book-2',
    rightsDecision: 'underlying-work-protected',
    alternativeSources: [
      { sourceUrl: 'https://example.org/other', rightsDecision: 'unclear' }
    ]
  });
  assert.equal(result.outcome, ALTERNATIVE_OUTCOMES.READ_ONLY_ORIGINAL);
});

test('a restricted source stays discoverable while requesting governed discovery', () => {
  const result = resolveAlternativeSource({ id: 'book-3', rightsDecision: 'read-only' });
  assert.equal(result.outcome, ALTERNATIVE_OUTCOMES.NEEDS_DISCOVERY);
});
