import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCrossLanguageQuery,
  classifyTranslation,
  detectLanguageHint,
  normalizeLanguageTag,
  resolveResponseLanguage,
  textDirection,
} from '../src/multilingual-search-runtime.js';

test('normalizes BCP-47 language tags', () => {
  assert.equal(normalizeLanguageTag('fr_fr'), 'fr-FR');
  assert.equal(normalizeLanguageTag('TH-th'), 'th-TH');
});

test('detects common non-Latin scripts without requiring UI language settings', () => {
  assert.equal(detectLanguageHint('วิดีโอเรื่องมูซา'), 'th');
  assert.equal(detectLanguageHint('من هو موسى؟'), 'ar');
  assert.equal(detectLanguageHint('誰がムーサですか'), 'ja');
});

test('prefers explicit response language, then query, then UI, then Arabic', () => {
  assert.equal(resolveResponseLanguage({ query: 'bonjour', requestedLanguage: 'en', uiLanguage: 'ar' }), 'en');
  assert.equal(resolveResponseLanguage({ query: 'วิดีโอเรื่องมูซา', uiLanguage: 'ar' }), 'th');
  assert.equal(resolveResponseLanguage({ query: 'bonjour', uiLanguage: 'fr' }), 'fr');
  assert.equal(resolveResponseLanguage({ query: 'bonjour' }), 'ar');
});

test('uses RTL/LTR independently of source language', () => {
  assert.equal(textDirection('ar'), 'rtl');
  assert.equal(textDirection('th'), 'ltr');
  assert.equal(textDirection('en-US'), 'ltr');
});

test('preserves the original query and expands entity aliases', () => {
  const result = buildCrossLanguageQuery({
    query: 'قصة موسى',
    responseLanguage: 'en',
    aliases: ['Musa', 'Moses', 'موسى'],
  });
  assert.equal(result.originalQuery, 'قصة موسى');
  assert.deepEqual(result.aliases, ['Musa', 'Moses', 'موسى']);
  assert.equal(result.searchStrategy, 'cross-language-entity-expansion');
  assert.equal(result.preserveOriginalText, true);
});

test('labels unverified translations instead of treating them as originals', () => {
  assert.equal(classifyTranslation({ sourceLanguage: 'ar', targetLanguage: 'th' }), 'machine-or-unverified-translation');
  assert.equal(classifyTranslation({ sourceLanguage: 'ar', targetLanguage: 'en', source: { verified: true } }), 'verified-translation');
  assert.equal(classifyTranslation({ sourceLanguage: 'ar', targetLanguage: 'ar' }), 'original');
});
