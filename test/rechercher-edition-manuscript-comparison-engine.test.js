import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareManifestations,
  comparePageRecords,
  createComparisonRecord,
} from '../src/rechercher-edition-manuscript-comparison-engine.js';

test('matches manifestations belonging to the same work and edition', () => {
  const result = compareManifestations(
    { manifestationId: 'm1', workId: 'w1', editionId: 'e1' },
    { manifestationId: 'm2', workId: 'w1', editionId: 'e1' },
  );
  assert.equal(result.identityMatch, true);
  assert.equal(result.editionMatch, true);
  assert.equal(result.state, 'MATCHED');
});

test('detects page-level text and image divergence', () => {
  const result = comparePageRecords(
    { pageId: 'p1', textHash: 'a', imageHash: 'img-a' },
    { pageId: 'p2', textHash: 'b', imageHash: 'img-b' },
  );
  assert.equal(result.state, 'DIVERGENT');
  assert.equal(result.reviewRequired, true);
});

test('requires provenance for comparison records', () => {
  assert.throws(
    () => createComparisonRecord({ comparisonId: 'c1', leftManifestationId: 'm1', rightManifestationId: 'm2' }),
    /comparison provenance is required/,
  );
});

test('preserves provenance and review state', () => {
  const result = createComparisonRecord({
    comparisonId: 'c2',
    leftManifestationId: 'm1',
    rightManifestationId: 'm2',
    provenance: { source: 'iiif' },
    reviewState: 'SCHOLAR_REVIEW_REQUIRED',
  });
  assert.equal(result.provenance.source, 'iiif');
  assert.equal(result.reviewState, 'SCHOLAR_REVIEW_REQUIRED');
  assert.equal(result.immutableInputs, true);
});
