import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_REUSABLE_ASSETS,
  DISCOVERY_STATES,
  FAITH_ROOT,
  FAITH_SECTIONS,
  PROFESSIONAL_CAPABILITIES,
  QURBAH_FAMILIES,
  TRUTH_ENTITIES,
  clearRights,
  corroborateDiscovery,
  createCompanionRecord,
  createDiscoveryCandidate,
  createFaithRoot,
  createKnowledgeSubject,
  createLanguageRecord,
  createProfessionalEngineRequirement,
  createQurbahRecord,
  createRelation,
  createTruthEntity,
  evaluateCardSource,
  faithMeshPolicy,
  publishCandidate,
  scholarlyReview
} from '../src/faith-proximity-knowledge-mesh.js';

test('faith root contains the full connected section family', () => {
  const root = createFaithRoot();
  assert.equal(root.label, FAITH_ROOT);
  assert.equal(root.sections.length, FAITH_SECTIONS.length);
});

test('truth types remain separate', () => {
  assert.equal(TRUTH_ENTITIES.includes('quran_text'), true);
  const quran = createTruthEntity({ id:'q', kind:'quran_text', content:'canonical', sourceIds:['source-q'], status:'verified' });
  const translation = createTruthEntity({ id:'t', kind:'machine_translation', content:'draft', sourceIds:['q'], status:'draft' });
  assert.equal(quran.canonical, true);
  assert.equal(translation.derived, true);
  assert.equal(translation.authoritative, false);
});

test('discovery needs two independent corroborators and scholarly reviews', () => {
  const candidate = createDiscoveryCandidate({ id:'x', title:'Topic', sourceIds:['s1'], discoveredAt:'2026-09-28T00:00:00Z' });
  const one = corroborateDiscovery(candidate,[{engineId:'a',independent:true}]);
  assert.equal(one.passed,false);
  const two = corroborateDiscovery(candidate,[{engineId:'a',independent:true},{engineId:'b',independent:true}]);
  assert.equal(two.state,'corroborated');
  const reviewed = scholarlyReview({...candidate,...two},[{engineId:'a',independent:true},{engineId:'b',independent:true}]);
  assert.equal(reviewed.state,'scholarly-reviewed');
});

test('rights clearance comes only after scholarly review and explicit permission evidence', () => {
  const blocked = clearRights({ state:'corroborated' }, { rightsSource:'s' });
  assert.equal(blocked.passed,false);
  const cleared = clearRights({ state:'scholarly-reviewed' }, {
    rightsSource:'s', rightsEvidenceId:'r', checkedAt:'t', checkedBy:'u', license:'CC0', redistributionAllowed:true
  });
  assert.equal(cleared.state,'rights-cleared');
});

test('single engine cannot approve a capability', () => {
  for (const capability of PROFESSIONAL_CAPABILITIES) {
    const req=createProfessionalEngineRequirement({
      capability, engines:[{engineId:'one',independent:true}]
    });
    assert.equal(req.minimumSatisfied,false);
    assert.equal(req.singleEngineApprovalAllowed,false);
  }
});

test('qurbah records are evidence-linked and preserve distinct practical layers', () => {
  const q=createQurbahRecord({
    id:'q1', family:QURBAH_FAMILIES[0], title:'Prayer', evidenceIds:['e1'],
    conditions:['c'], pillars:['p'], sunnan:['s'], virtues:['v'], objectives:['o'],
    commonMistakes:['m'], spiritualEffects:['e'], sincerity:['i'], following:['f']
  });
  assert.equal(q.evidenceIds[0],'e1');
  assert.equal(q.corpusMutation,false);
});

test('companionship disagreement remains explicit', () => {
  const companion=createCompanionRecord({
    id:'c1', name:'Person', companionshipStatus:'disputed', companionshipEvidence:['e1']
  });
  assert.equal(companion.companionshipStatus,'disputed');
  assert.equal(companion.automatedCompanionshipVerdict,false);
});

test('machine translation remains draft and Quran canonical text stays separate', () => {
  const lang=createLanguageRecord({locale:'fr',language:'French',script:'Latin',direction:'ltr',machineGenerated:true,translationStatus:'machine-draft'});
  assert.equal(lang.approvedReligiousTranslation,false);
  assert.equal(lang.canonicalQuranTextIndependent,true);
});

test('card studio accepts only publishable content and reusable assets and is deterministic', () => {
  const content=[{id:'topic-1',state:'publishable',sourceIds:['s1']}];
  const card=evaluateCardSource({
    contentIds:content, locale:'ar', templateId:'faith-card', templateVersion:'1',
    asset:{url:'https://example.org/image.svg',sha256:'a'.repeat(64),rightsStatus:'cc0',redistributionAllowed:true}
  });
  assert.equal(card.allowed,true);
  assert.equal(card.vectorFirst,true);
  assert.equal(card.formats.includes('svg'),true);
  assert.equal(typeof card.fingerprint,'string');
});

test('card blocks an unknown-license asset', () => {
  const card=evaluateCardSource({
    contentIds:[{id:'topic-1',state:'publishable',sourceIds:['s1']}],
    locale:'ar', templateId:'faith-card', templateVersion:'1',
    asset:{url:'https://example.org/image.jpg',sha256:'b'.repeat(64),rightsStatus:'unknown',redistributionAllowed:false}
  });
  assert.equal(card.allowed,false);
});

test('relations preserve evidence and confidence', () => {
  const rel=createRelation({subjectId:'allah',relation:'explains',objectId:'attribute',evidenceIds:['q1'],confidenceState:'scholarly-reviewed'});
  assert.deepEqual(rel.evidenceIds,['q1']);
});

test('publication requires rights, quality and two independent publication reviews', () => {
  const result=publishCandidate({state:'rights-cleared'},{
    publicationReviews:[{engineId:'a',independent:true},{engineId:'b',independent:true}],
    rights:{rightsStatus:'cc-by',redistributionAllowed:true},
    qualityScore:85
  });
  assert.equal(result.passed,true);
  assert.equal(publishCandidate({state:'rights-cleared'},{
    publicationReviews:[{engineId:'a',independent:true}],
    rights:{rightsStatus:'cc-by',redistributionAllowed:true}, qualityScore:85
  }).passed,false);
});

test('faith mesh policy preserves free-first access without rights inference', () => {
  const p=faithMeshPolicy();
  assert.equal(p.freeAccessTarget,true);
  assert.equal(p.freeDoesNotMeanPublicDomain,true);
  assert.equal(ALLOWED_REUSABLE_ASSETS.includes('owned-original'),true);
  assert.equal(DISCOVERY_STATES[0],'discovered');
});
