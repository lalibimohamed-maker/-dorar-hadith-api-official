import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const registry = JSON.parse(fs.readFileSync(path.join(root, 'config/rechercher-multilingual-source-network-2026.json'), 'utf8'));
const { buildCells, discoverLanguages, translationDecision, assertCanonicalSeparation } = await import('../scripts/rechercher-multilingual-source-network.mjs');

test('initial multilingual network is exactly 23 × 24 = 552 cells', () => {
  assert.equal(registry.languages.length, 23);
  assert.equal(registry.domains.length, 24);
  assert.equal(buildCells().length, 552);
});

test('network has no language ceiling and expands every new language across all domains', () => {
  const expanded = discoverLanguages([{ language_id: 'sq', language_name: 'Albanian', source_id: 'test-source' }]);
  assert.equal(expanded.length, 24);
  assert.equal(buildCells(expanded).length, 24 * 24);
  assert.equal(expanded.at(-1).id, 'sq');
});

test('translation-needed is preserved when no verified translation exists', () => {
  assert.equal(translationDecision({ hasVerifiedTranslation: false, machineTranslationAvailable: false }), 'translation-needed');
  assert.equal(translationDecision({ hasVerifiedTranslation: false, machineTranslationAvailable: true }), 'machine-translated');
  assert.equal(translationDecision({ hasVerifiedTranslation: true, machineTranslationAvailable: true }), 'source-verified');
});

test('canonical Quran Arabic remains separate from translations', () => {
  assert.doesNotThrow(() => assertCanonicalSeparation({ domain: 'quran' }));
  assert.throws(() => assertCanonicalSeparation({ domain: 'quran', translation_text: 'x' }), /canonical_arabic_quran/);
  assert.doesNotThrow(() => assertCanonicalSeparation({ domain: 'translations', canonical_verse_id: '3:85' }));
  assert.throws(() => assertCanonicalSeparation({ domain: 'translations' }), /canonical_verse_id/);
});

test('translation states include provenance-oriented verification levels and machine-translated', () => {
  for (const state of ['source-verified', 'institutionally-reviewed', 'scholarly', 'provenance-complete', 'candidate', 'machine-translated', 'unverified']) {
    assert.ok(registry.translation_states.includes(state));
  }
});
