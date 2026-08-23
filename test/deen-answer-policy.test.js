import assert from 'node:assert/strict';
import test from 'node:test';
import { answerPolicy, canPresentAsPrimaryEvidence, classifyEvidence } from '../src/deen-answer-policy.js';

test('trusted evidence can be primary', () => {
  const evidence = { sourceId: 'bukhari', citation: '1', verificationState: 'source_verified' };
  assert.equal(classifyEvidence(evidence), 'trusted');
  assert.equal(canPresentAsPrimaryEvidence(evidence), true);
});

test('generated material is never primary evidence', () => {
  const evidence = { generated: true, sourceId: 'ai', citation: 'generated' };
  assert.equal(classifyEvidence(evidence), 'generated');
  assert.equal(canPresentAsPrimaryEvidence(evidence), false);
  assert.equal(answerPolicy({ evidence: [evidence] }).primaryEvidence.length, 0);
});

test('source-backed but unverified evidence remains visibly unverified', () => {
  const evidence = { sourceId: 'book', citation: 'p. 10' };
  const result = answerPolicy({ evidence: [evidence] });
  assert.equal(result.primaryEvidence.length, 0);
  assert.equal(result.unverifiedEvidence.length, 1);
});
