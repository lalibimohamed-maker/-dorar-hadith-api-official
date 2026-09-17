import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('config/rechercher/multilingual-resource-expansion-2026.json');
const registry = JSON.parse(fs.readFileSync(file, 'utf8'));

test('expanded multilingual registry contains more than the initial 23-language phase', () => {
  assert.ok(registry.languages.length > 23);
  assert.equal(new Set(registry.languages.map((x) => x.iso)).size, registry.languages.length);
});

test('every language has a source and verification state', () => {
  for (const language of registry.languages) {
    assert.match(language.iso, /^[a-z]{2,3}$/);
    assert.ok(language.name);
    assert.ok(language.source);
    assert.ok(language.status);
  }
});

test('resource routes preserve the full provenance and rights pipeline', () => {
  assert.deepEqual(registry.resource_routes, [
    'primary_or_institutional_source',
    'official_api',
    'digital_corpus',
    'structured_web',
    'scholarly_dataset',
    'translation_metadata',
    'provenance',
    'rights',
    'verification'
  ]);
});

test('Quran Arabic, human translation, and machine translation remain separate', () => {
  assert.equal(registry.quran_boundary, 'canonical_arabic_quran != human_translation != machine_translation');
  assert.match(registry.missing_translation_rule, /translation-needed/);
  assert.match(registry.missing_translation_rule, /machine-translated/);
});

test('QuranEnc is registered as an API-backed resource provider', () => {
  const provider = registry.providers.find((x) => x.id === 'quranenc');
  assert.ok(provider);
  assert.match(provider.kind, /api/);
  assert.match(provider.url, /^https:\/\//);
});
