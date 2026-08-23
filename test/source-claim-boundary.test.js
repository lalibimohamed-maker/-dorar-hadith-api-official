import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyClaim, validateClaimBoundary } from '../src/source-claim-boundary.js';

test('preserves primary and transmitted material as source-backed claims', () => {
  const primary = classifyClaim({ kind: 'primary_text', sourceId: 'quran:1:1', citation: '1:1' });
  const report = classifyClaim({ kind: 'transmitted_report', sourceId: 'hadith:abc', citation: 'abc' });
  assert.equal(primary.sourceBacked, true);
  assert.equal(primary.canPresentAsOriginal, true);
  assert.equal(report.canPresentAsOriginal, true);
});

test('keeps scholarly statements distinct from explanations', () => {
  const scholar = classifyClaim({ kind: 'scholarly_statement', sourceId: 'scholar:1', citation: 'p. 10' });
  const explanation = classifyClaim({ kind: 'explanation' });
  assert.equal(scholar.canPresentAsScholarlyStatement, true);
  assert.equal(explanation.mustLabelAsInterpretation, true);
  assert.equal(explanation.canPresentAsOriginal, false);
});

test('marks algorithmic signals as algorithmic and not source-backed', () => {
  const signal = classifyClaim({ kind: 'algorithmic_signal' });
  assert.equal(signal.sourceBacked, false);
  assert.equal(signal.mustLabelAsAlgorithmic, true);
  assert.equal(signal.canPresentAsOriginal, false);
});

test('rejects unknown claim kinds', () => {
  assert.throws(() => classifyClaim({ kind: 'religious_truth' }), /Unsupported claim kind/);
});

test('validates batches consistently', () => {
  const result = validateClaimBoundary([
    { kind: 'primary_text', sourceId: 'q', citation: '1' },
    { kind: 'algorithmic_signal' }
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[1].mustLabelAsAlgorithmic, true);
});
