import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const registry = JSON.parse(
  await readFile(new URL('../config/free-book-processing-group-2026.json', import.meta.url), 'utf8'),
);

test('book processing group is free-first and local-first', () => {
  assert.equal(registry.costPolicy.requiredSubscription, false);
  assert.equal(registry.costPolicy.requiredPaidApi, false);
  assert.equal(registry.costPolicy.localFirst, true);
  assert.equal(registry.principles.preserveOriginal, true);
  assert.equal(registry.principles.neverOverwriteSource, true);
});

test('independent Arabic OCR engines are present', () => {
  const ids = registry.group.map((engine) => engine.id);
  assert.ok(ids.includes('tesseract'));
  assert.ok(ids.includes('paddleocr'));
  assert.ok(ids.includes('kraken'));
  assert.ok(registry.orchestration.ocrConsensus.minimumEnginesForNormalArabicPage >= 2);
});

test('blank-marker replacement is constrained to the local blank region', () => {
  const safety = registry.orchestration.visualSafety;
  assert.equal(safety.blankMarker, '……………………');
  assert.equal(safety.blankReplacement, 'sample-local-background-and-mask-marker-only');
  assert.equal(safety.preserveQuestion, true);
  assert.equal(safety.rejectIfNonBlankPixelsChangeBeyondMask, true);
});

test('license-gated engines cannot silently become core engines', () => {
  assert.equal(registry.optionalEngines.surya.status, 'license-gated');
  assert.equal(registry.group.find((engine) => engine.id === 'real-esrgan').gate.includes('never invent text'), true);
});
