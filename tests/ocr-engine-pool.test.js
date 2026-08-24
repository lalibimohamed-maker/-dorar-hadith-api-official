import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileOcrResults } from '../src/ocr-engine-pool.js';

test('accepts independent agreement', () => {
  const result = reconcileOcrResults([
    { engine: 'engine-a', result: { text: 'نص صحيح' } },
    { engine: 'engine-b', result: { text: 'نص صحيح' } },
    { engine: 'engine-c', result: { text: 'نص مختلف' } },
  ]);
  assert.equal(result.status, 'verified-agreement');
  assert.equal(result.text, 'نص صحيح');
});

test('requires review when engines disagree without a reference', () => {
  const result = reconcileOcrResults([
    { engine: 'engine-a', result: { text: 'نص أول' } },
    { engine: 'engine-b', result: { text: 'نص ثان' } },
  ]);
  assert.equal(result.status, 'needs-review');
  assert.equal(result.text, null);
});

test('uses an exact trusted reference only when every OCR result agrees with it', () => {
  const result = reconcileOcrResults([
    { engine: 'engine-a', result: { text: 'مرجع موثوق' } },
    { engine: 'engine-b', result: { text: 'مرجع موثوق' } },
  ], { referenceText: 'مرجع موثوق' });
  assert.equal(result.status, 'verified-reference');
});
