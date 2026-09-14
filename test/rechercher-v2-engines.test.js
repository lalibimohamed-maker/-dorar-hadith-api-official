import test from 'node:test';
import assert from 'node:assert/strict';
import { createFederationEngine, registerFederatedRecord, recordFederatedQuery, getFederatedSources } from '../src/rechercher-source-federation-engine.js';
import { createConceptEngine, registerConcept, registerTerm, alignTerms } from '../src/rechercher-multilingual-concepts-engine.js';
import { createScheduler, scheduleReview, dueCards } from '../src/rechercher-adaptive-scheduler-engine.js';
import { validateManifest, normalizeManifest, linkPassageToCanvas } from '../src/rechercher-manuscript-manifest-engine.js';

test('federation keeps provider and provenance identity', () => {
  const e = createFederationEngine();
  registerFederatedRecord(e, { sourceId: 'openiti:1', provider: 'OPENITI', retrievedAt: '2026-09-14T00:00:00Z', recordHash: 'sha256:1' });
  recordFederatedQuery(e, { queryId: 'q1', provider: 'OPENITI', executedAt: '2026-09-14T00:00:00Z', query: 'kitab' });
  assert.equal(getFederatedSources(e, 'OPENITI').length, 1);
  assert.throws(() => registerFederatedRecord(e, { sourceId: 'x', provider: 'UNKNOWN', retrievedAt: 'x', recordHash: 'x' }));
});

test('concepts preserve multilingual distinction instead of false equivalence', () => {
  const e = createConceptEngine();
  registerConcept(e, { conceptId: 'fiqh:wajib', label: 'واجب', domain: 'fiqh' });
  registerTerm(e, { termId: 'ar:wajib', conceptId: 'fiqh:wajib', language: 'ar', term: 'واجب' });
  registerTerm(e, { termId: 'fr:wajib', conceptId: 'fiqh:wajib', language: 'fr', term: 'obligation' });
  alignTerms(e, { alignmentId: 'a1', fromTermId: 'ar:wajib', toTermId: 'fr:wajib', matchType: 'CLOSE', confidence: 0.8 });
  assert.equal(e.alignments.get('a1').matchType, 'CLOSE');
});

test('adaptive scheduler is configurable and records review state', () => {
  const e = createScheduler({ baseDays: 1, maxDays: 30 });
  const first = scheduleReview(e, { cardId: 'c1', correct: true, confidence: 0.9, now: '2026-09-14T00:00:00Z' });
  assert.ok(first.nextReviewAt > first.reviewedAt);
  scheduleReview(e, { cardId: 'c1', correct: false, confidence: 0.2, now: '2026-09-15T00:00:00Z' });
  assert.equal(dueCards(e, '2026-09-16T00:00:00Z').length, 1);
});

test('manuscript manifests validate and preserve page-passage links', () => {
  const manifest = normalizeManifest({ id: 'm1', label: { ar: 'مخطوط' }, items: [{ id: 'c1', type: 'Canvas' }] });
  assert.equal(validateManifest(manifest).valid, true);
  const link = linkPassageToCanvas({ manifestId: 'm1', canvasId: 'c1', passageId: 'p1', textRange: '1:20-1:40', sourceHash: 'sha256:page' });
  assert.equal(link.sourceHash, 'sha256:page');
});
