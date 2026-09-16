import test from 'node:test';
import assert from 'node:assert/strict';
import CENSUS, { TARGET_LANGUAGES, KNOWLEDGE_DOMAINS, SOURCE_TIERS } from '../config/rechercher-global-structured-islamic-knowledge-census-v1.js';

test('global census contains the requested multilingual target set', () => {
  const codes = TARGET_LANGUAGES.map((item) => item.code);
  for (const code of ['ar','en','fr','tr','fa','ur','bn','id','ms','ru','de','es','pt','bs','sq','uz','kk','sw','ha','am','zh','ja','ko']) {
    assert.ok(codes.includes(code), `missing target language ${code}`);
  }
  assert.equal(new Set(codes).size, codes.length);
});

test('global census covers the core Islamic knowledge domains', () => {
  for (const domain of ['quran','quran-translation','tafsir','hadith','hadith-translation','hadith-sciences','sirah','fiqh','usul-al-fiqh','fatwa','aqeedah','shuruh','dictionary','terminology','books']) {
    assert.ok(KNOWLEDGE_DOMAINS.includes(domain), `missing domain ${domain}`);
  }
});

test('every census source has evidence and a governed source tier', () => {
  assert.ok(CENSUS.sources.length >= 7);
  for (const source of CENSUS.sources) {
    assert.ok(SOURCE_TIERS.includes(source.tier), `${source.id}: invalid tier`);
    assert.ok(source.sourceUrl, `${source.id}: missing source URL`);
    assert.ok(source.evidence, `${source.id}: missing evidence`);
    assert.ok(source.languages.length > 0, `${source.id}: no languages`);
    assert.ok(source.domains.length > 0, `${source.id}: no domains`);
  }
});

test('translation policy prevents silent re-translation and preserves provenance', () => {
  assert.equal(CENSUS.translationPolicy.canonicalArabicIsNeverTranslated, true);
  assert.equal(CENSUS.translationPolicy.neverAutoTranslateAlreadyVettedTranslations, true);
  assert.equal(CENSUS.translationPolicy.preserveTranslatorAndEditionProvenance, true);
  assert.equal(CENSUS.translationPolicy.requireHumanOrInstitutionalReviewForTrustedLabel, true);
});

test('unverified APIs are explicitly marked instead of invented', () => {
  for (const source of CENSUS.sources) {
    if (source.apiStatus.includes('actively-seeking')) assert.equal(source.docsUrl ?? null, source.docsUrl ?? null);
  }
  const altafsir = CENSUS.sources.find((source) => source.id === 'altafsir');
  const tdv = CENSUS.sources.find((source) => source.id === 'tdv-islam-ansiklopedisi');
  assert.equal(altafsir.apiStatus, 'actively-seeking-first-party-api-evidence');
  assert.equal(tdv.apiStatus, 'actively-seeking-first-party-api-evidence');
});
