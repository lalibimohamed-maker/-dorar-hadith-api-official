import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareWorkCandidates,
  reconcileWorkCandidate,
  chooseBestManifestation,
  assertImmutableSource,
  createReconciliationTrace,
} from '../src/rechercher-global-work-reconciliation-engine.js';

test('reconciles equivalent work candidates without requiring identical titles', () => {
  const result = reconcileWorkCandidate(
    { title: 'Sahih al-Bukhari', author: 'Muhammad al-Bukhari', edition: 'edition A', provenance: 'catalog:A', rightsState: 'ALLOWED' },
    [{ workId: 'work:1', title: 'صحيح البخاري', author: 'Muhammad al-Bukhari', edition: 'edition A' }],
  );
  assert.equal(result.matched, true);
  assert.equal(result.action, 'LINK_TO_EXISTING_WORK');
});

test('requires provenance and rights before reconciliation', () => {
  assert.throws(() => reconcileWorkCandidate({ title: 'x' }, []), /provenance is required/);
});

test('ranks manifestations without replacing the immutable original', () => {
  const selected = chooseBestManifestation([
    { id: 'low', identityScore: .9, completenessScore: .7, imageQualityScore: .4, pdfIntegrityScore: .9, provenanceScore: .8, rightsScore: 1 },
    { id: 'high', identityScore: 1, completenessScore: 1, imageQualityScore: .95, pdfIntegrityScore: 1, provenanceScore: 1, rightsScore: 1 },
  ]);
  assert.equal(selected.id, 'high');
});

test('protects immutable source identity and hash', () => {
  assert.equal(assertImmutableSource({ sourceIdentity: 's1', contentHash: 'h1' }, { sourceIdentity: 's1', contentHash: 'h1' }), true);
  assert.throws(() => assertImmutableSource({ contentHash: 'h1' }, { contentHash: 'h2' }), /contentHash/);
});

test('creates provenance-aware reconciliation traces', () => {
  const trace = createReconciliationTrace({ workId: 'work:1', sourceId: 'source:1', decision: 'LINK_TO_EXISTING_WORK', confidence: .94, provenance: 'catalog:1', rightsState: 'ALLOWED' });
  assert.equal(trace.confidence, .94);
  assert.equal(trace.rightsState, 'ALLOWED');
});

test('exposes transparent comparison scores', () => {
  const scores = compareWorkCandidates({ title: 'Kitab', author: 'Author' }, { title: 'Kitab', author: 'Author' });
  assert.equal(scores.title, 1);
  assert.equal(scores.author, 1);
});
