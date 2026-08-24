import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RIGHTS } from '../src/book-rights-resolver.js';

test('digital book OCR policy matches the fail-closed rights model', async () => {
  const policy = JSON.parse(await readFile(new URL('../config/digital-books-ocr-policy.json', import.meta.url), 'utf8'));
  assert.deepEqual([...policy.rightsStatuses].sort(), Object.values(RIGHTS).sort());
  assert.ok(policy.ocrPipeline.steps.includes('store-raw-ocr-separately'));
  assert.ok(policy.ocrPipeline.steps.includes('store-corrected-text-as-reviewed-layer'));
  assert.equal(policy.ocrPipeline.rule.includes('never authoritative'), true);
  assert.equal(policy.copyrightRule.includes('Catalog and link'), true);
});
