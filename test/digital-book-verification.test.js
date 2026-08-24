import test from 'node:test';
import assert from 'node:assert/strict';
import { applyVerifiedText, verifyExtractedText } from '../src/digital-book-verification.js';

test('independent candidate agreement verifies without rewriting text', () => {
  const result = verifyExtractedText({
    primary: 'الحمد لله رب العالمين',
    candidates: ['الحمد لله رب العالمين'],
  });
  assert.equal(result.status, 'verified-agreement');
  assert.deepEqual(applyVerifiedText('الحمد لله رب العالمين', result), {
    text: 'الحمد لله رب العالمين',
    changed: false,
    verified: true,
  });
});

test('trusted reference can verify an exact match', () => {
  const result = verifyExtractedText({
    primary: 'نص موثوق',
    trustedReference: 'نص موثوق',
  });
  assert.equal(result.status, 'verified-reference');
  assert.equal(result.confidence, 1);
});

test('disagreement is sent to review and never corrected by guesswork', () => {
  const result = verifyExtractedText({
    primary: 'النص الأصلي',
    candidates: ['النص المختلف', 'نص آخر مختلف'],
  });
  assert.equal(result.status, 'needs-review');
  const applied = applyVerifiedText('النص الأصلي', result);
  assert.equal(applied.verified, false);
  assert.equal(applied.changed, false);
  assert.equal(applied.text, 'النص الأصلي');
});

test('candidate normalization supports harmless whitespace differences', () => {
  const result = verifyExtractedText({
    primary: 'كتاب  نافع',
    candidates: ['كتاب نافع'],
  });
  assert.equal(result.status, 'verified-agreement');
});
