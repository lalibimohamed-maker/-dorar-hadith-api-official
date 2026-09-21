import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RESEARCH_RESOURCE_FAMILIES,
  RESOURCE_POLICY,
  createV6V8Integration,
  registerResearchResource,
  verifyResearchResource,
  buildLearningPlanFromVerifiedResource,
  integrationHealth,
} from '../src/rechercher-v6-v8-resource-integration-engine.js';

test('V6/V8 integration registers the requested research resource families with safe defaults', () => {
  const integration = createV6V8Integration({ learner: { learnerId: 'l1' } });
  assert.ok(RESEARCH_RESOURCE_FAMILIES.includes('OPENITI_KITAB'));
  assert.ok(RESEARCH_RESOURCE_FAMILIES.includes('INTERNET_ARCHIVE'));
  assert.ok(RESEARCH_RESOURCE_FAMILIES.includes('GALLICA_BNF'));
  assert.ok(RESEARCH_RESOURCE_FAMILIES.includes('MINHADJ_RU'));
  assert.equal(RESOURCE_POLICY.rightsDefault, 'UNKNOWN');
  assert.equal(RESOURCE_POLICY.unknownPublishable, false);
  assert.equal(RESOURCE_POLICY.originalPdfImmutable, true);
  assert.equal(RESOURCE_POLICY.canonicalQuranArabicImmutable, true);
  assert.equal(RESOURCE_POLICY.acquisitionIndependent, true);
  registerResearchResource(integration, {
    resourceId: 'resource-openiti-1',
    family: 'OPENITI_KITAB',
    sourceUrl: 'https://example.org/openiti',
    provenance: { provider: 'OpenITI/KITAB', retrieval: 'catalog' },
    rightsState: 'UNKNOWN',
  });
  assert.equal(integration.resources.length, 1);
  assert.equal(integration.v6.candidates.size, 1);
});

test('V6 verified source becomes an evidence-grounded V8 learning source only after rights evidence', () => {
  const integration = createV6V8Integration({ learner: { learnerId: 'l1', skills: { fiqh: { mastery: 0.2, confidence: 0.5, attempts: 2 } } } });
  registerResearchResource(integration, {
    resourceId: 'resource-waqfeya-1',
    family: 'WAQFEYA',
    sourceUrl: 'https://example.org/waqfeya',
    provenance: { provider: 'Waqfeya', retrieval: 'catalog' },
    rightsState: 'UNKNOWN',
  });
  const verified = verifyResearchResource(integration, 'resource-waqfeya-1', {
    sourceId: 'source:waqfeya:1',
    rightsState: 'ALLOWED',
    rightsEvidence: { license: 'CC-BY' },
    sourceIdentity: { authority: 'Waqfeya' },
  });
  assert.equal(verified.publishable, true);
  const plan = buildLearningPlanFromVerifiedResource(integration, {
    skillId: 'fiqh',
    graph: { edges: [] },
    result: { correct: false, confidence: 0.8 },
    goal: 'understand',
  });
  assert.equal(plan.recommendedSource.sourceId, 'source:waqfeya:1');
  assert.equal(plan.religiousAuthority, 'UNCHANGED_SOURCE_AND_SCHOLAR_REVIEW_POLICY');
  assert.equal(plan.acquisitionIndependent, true);
});

test('V6/V8 integration never turns restricted or unknown resources into publishable learning sources', () => {
  const integration = createV6V8Integration();
  registerResearchResource(integration, {
    resourceId: 'resource-restricted',
    family: 'SHAMELA',
    sourceUrl: 'https://example.org/restricted',
    provenance: { provider: 'Shamela' },
    rightsState: 'RESTRICTED',
  });
  const verified = verifyResearchResource(integration, 'resource-restricted', {
    sourceId: 'source:restricted',
    rightsState: 'RESTRICTED',
    rightsEvidence: { license: 'restricted' },
  });
  assert.equal(verified.publishable, false);
  assert.equal(integrationHealth(integration).publishableSources, 0);
});
