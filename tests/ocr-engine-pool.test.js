import { describe, expect, it } from 'vitest';
import { reconcileOcrResults } from '../src/ocr-engine-pool.js';

describe('OCR engine pool integrity', () => {
  it('accepts independent agreement', () => {
    const result = reconcileOcrResults([
      { engine: 'engine-a', result: { text: 'نص صحيح' } },
      { engine: 'engine-b', result: { text: 'نص صحيح' } },
      { engine: 'engine-c', result: { text: 'نص مختلف' } },
    ]);
    expect(result.status).toBe('verified-agreement');
    expect(result.text).toBe('نص صحيح');
  });

  it('requires review when engines disagree without a reference', () => {
    const result = reconcileOcrResults([
      { engine: 'engine-a', result: { text: 'نص أول' } },
      { engine: 'engine-b', result: { text: 'نص ثان' } },
    ]);
    expect(result.status).toBe('needs-review');
    expect(result.text).toBeNull();
  });

  it('uses an exact trusted reference only when every OCR result agrees with it', () => {
    const result = reconcileOcrResults([
      { engine: 'engine-a', result: { text: 'مرجع موثوق' } },
      { engine: 'engine-b', result: { text: 'مرجع موثوق' } },
    ], { referenceText: 'مرجع موثوق' });
    expect(result.status).toBe('verified-reference');
  });
});
