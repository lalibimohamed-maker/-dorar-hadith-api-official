import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DISCOVERY_STATES,
  LANGUAGE_FIELDS,
  RETRIEVAL_PIPELINE,
  buildMultilingualResponseContext,
  createMediaSource,
  createReligiousEvidenceRecord,
  createVerifiedTranslation,
  detectUserLanguages,
  evaluateEvidenceSufficiency,
  languageDirection,
  multilingualRetrievalPlan,
  registerCanonicalEntity,
  resolvePresentationLanguages
} from '../src/global-multilingual-knowledge-network.js';

test('retrieval pipeline is explicit and language remains a presentation layer', () => {
  assert.deepEqual(RETRIEVAL_PIPELINE, [
    'user-language','intent-detection','multilingual-retrieval','source-verification','provenance-graph','response-user-language'
  ]);
  assert.deepEqual(LANGUAGE_FIELDS, ['uiLanguage','queryLanguage','responseLanguage','sourceLanguage']);
  assert.equal(DISCOVERY_STATES, undefined);
});

test('Arabic/English detection supports automatic direction and mixed-language queries', () => {
  const ar = detectUserLanguages('ما حكم التوبة؟');
  assert.equal(ar.primary, 'ar');
  assert.equal(ar.direction, 'rtl');
  const mixed = detectUserLanguages('ما معنى tawbah in Islam?');
  assert.equal(mixed.mixed, true);
  assert.equal(mixed.languages.some((x) => x.language === 'ar'), true);
});

test('Latin-script language detection provides a best-effort user language without requiring UI registration', () => {
  const fr = detectUserLanguages('quelle est la preuve et comment comprendre le Coran');
  assert.equal(fr.primary, 'fr');
  const es = detectUserLanguages('qué dice el corán sobre la taqwa');
  assert.equal(es.primary, 'es');
});

test('UI/query/response/source languages are independent', () => {
  const detected = detectUserLanguages('Bonjour, que dit le Coran ?');
  const p = resolvePresentationLanguages({
    detected, uiLanguage:'ar', queryLanguage:'fr', preferredResponseLanguage:'fr', sourceLanguage:'ar'
  });
  assert.equal(p.uiLanguage,'ar');
  assert.equal(p.queryLanguage,'fr');
  assert.equal(p.responseLanguage,'fr');
  assert.equal(p.sourceLanguage,'ar');
  assert.equal(p.responseDirection,'ltr');
});

test('canonical entities and aliases enable cross-language retrieval without identity changes', () => {
  const entity = registerCanonicalEntity({
    canonicalId:'concept-taqwa',
    aliases:{ar:['التقوى'],en:['taqwa','god consciousness'],fr:['piété']},
    sourceIds:['source-1']
  });
  const detected = detectUserLanguages('اشرح taqwa');
  const plan = multilingualRetrievalPlan({
    query:'اشرح taqwa', detected, canonicalEntities:[entity], sourceLanguages:['ar','en','fr'], intent:'explain'
  });
  assert.deepEqual(plan.canonicalEntityIds,['concept-taqwa']);
  assert.equal(plan.preservesCanonicalIdentity,true);
});

test('verified translations identify translator/source and machine translations stay drafts', () => {
  const draft = createVerifiedTranslation({
    id:'tr-1', canonicalSourceId:'q-1', language:'fr', text:'draft', translator:'machine-x', sourceId:'source-fr'
  });
  assert.equal(draft.state,'machine-draft');
  assert.equal(draft.replacesOriginal,false);
  const verified = createVerifiedTranslation({
    id:'tr-2', canonicalSourceId:'q-1', language:'fr', text:'reviewed', translator:'translator-1',
    sourceId:'source-fr', state:'verified', reviewedAt:'2026-09-28T00:00:00Z'
  });
  assert.equal(verified.state,'verified');
});

test('religious evidence always carries provenance', () => {
  const e = createReligiousEvidenceRecord({
    claimId:'claim-1', sourceId:'book-1', sourceLanguage:'ar', provenanceId:'prov-1',
    verified:true, citation:'book/page'
  });
  assert.equal(e.provenanceRequired,true);
  assert.equal(e.provenanceId,'prov-1');
});

test('media is media by default, not religious authority', () => {
  const video = createMediaSource({id:'v1',kind:'video',url:'https://example.org/v.mp4'});
  assert.equal(video.mediaByDefault,true);
  assert.equal(video.religiousAuthorityByDefault,false);
  assert.equal(video.scientificAuthority,false);
});

test('insufficient evidence produces a stop policy instead of invented certainty', () => {
  const result = evaluateEvidenceSufficiency({evidence:[],requiredCount:1});
  assert.equal(result.sufficient,false);
  assert.equal(result.state,'insufficient-evidence');
  assert.match(result.responsePolicy,/do-not-invent/);
});

test('response context preserves provenance and user language', () => {
  const detected=detectUserLanguages('What is taqwa?');
  const presentation=resolvePresentationLanguages({detected,uiLanguage:'ar'});
  const evidence=[createReligiousEvidenceRecord({
    claimId:'c1',sourceId:'s1',sourceLanguage:'ar',provenanceId:'p1',verified:true
  })];
  const ctx=buildMultilingualResponseContext({query:'What is taqwa?',detected,presentation,evidence});
  assert.equal(ctx.language,'en');
  assert.equal(ctx.provenanceIds[0],'p1');
  assert.equal(ctx.evidenceState,'evidence-sufficient');
});

test('direction helper is deterministic', () => {
  assert.equal(languageDirection('ar'),'rtl');
  assert.equal(languageDirection('fr'),'ltr');
});
