import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCardFooter, buildRegenerationKey, validateCardManifest } from '../src/card-studio.js';

test('card studio rejects unsupported rights and unreviewed religious machine translation', () => {
  const result = validateCardManifest({
    cardId: 'example', sourceId: 'src-1', canonicalText: 'text', locale: 'de', format: 'svg',
    assetLicenseState: 'unknown-license', machineTranslated: true, religiousMeaningReviewed: false
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /not publishable/);
  assert.match(result.errors.join(' '), /requires reviewed meaning/);
});

test('card footer carries the encyclopedia signature and lineage fields', () => {
  const footer = buildCardFooter({ sourceShortForm: 'Quran 16:90', license: 'CC BY', generatedAt: '2026-08-28T00:00:00Z', cardId: 'c1' });
  assert.equal(footer.brand, 'موسوعة دين الله');
  assert.equal(footer.cardId, 'c1');
});

test('regeneration key is stable for identical input', () => {
  const manifest = { cardId: 'c1', sourceId: 's1', canonicalText: 'hello', locale: 'ar', format: 'svg', templateVersion: '1' };
  assert.equal(buildRegenerationKey(manifest), buildRegenerationKey({ ...manifest }));
});
