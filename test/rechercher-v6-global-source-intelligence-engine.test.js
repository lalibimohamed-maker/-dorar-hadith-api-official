import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createV6GlobalSourceIntelligenceEngine,
  createV6StageNodeContract,
  registerV6Node,
  discoverSource,
  classifySource,
  resolveSourceIdentity,
  evaluateRights,
  verifySource,
  linkSourceToWorkEditionManuscript,
  isPublishableSource,
  v6Health
} from '../src/rechercher-v6-global-source-intelligence-engine.js';
import { createStageNodeContract } from '../src/rechercher-stage-node-contract.js';
import { createStageNetworkRegistry, registerNode, validateHandoff, routeHandoff } from '../src/rechercher-stage-network-registry.js';

test('V6 remains a safe extension point and cannot weaken immutable safety invariants', () => {
  const contract = createV6StageNodeContract();
  assert.equal(contract.stageId, 'V6_GLOBAL_SOURCE_INTELLIGENCE');
  assert.equal(contract.status, 'OPEN_EXTENSION_POINT');
  assert.equal(contract.safety.canOverrideRights, false);
  assert.equal(contract.safety.canMutateSourceIdentity, false);
  assert.equal(contract.safety.canMutateContentHash, false);
  assert.equal(contract.safety.canMutateCanonicalQuranArabic, false);
  assert.equal(contract.safety.canMutateOriginalPdf, false);
  assert.deepEqual(contract.dependencies, ['V5_GLOBAL_RESEARCH']);
});

test('V6 registers through the shared stage registry and accepts V5 research output', () => {
  const registry = createStageNetworkRegistry();
  const v5 = createStageNodeContract({
    stageId: 'V5_GLOBAL_RESEARCH', version: '1.0', capabilities: ['GLOBAL_RESEARCH'],
    acceptedInputs: [{ type: 'STAGE_OUTPUT' }], producedOutputs: [{ type: 'RESEARCH_OUTPUT' }],
    requiredEvidence: [{ type: 'SOURCE_IDENTITY' }, { type: 'RIGHTS_STATE' }],
    rightsPolicy: { defaultState: 'UNKNOWN', publishableState: 'ALLOWED' },
    reviewPolicy: { scholarlyVerification: true }, dependencies: [], handoffs: ['RESEARCH_TO_SOURCE_INTELLIGENCE']
  });
  registerNode(registry, v5);
  registerV6Node(registry);
  assert.equal(validateHandoff(registry, 'V5_GLOBAL_RESEARCH', 'V6_GLOBAL_SOURCE_INTELLIGENCE'), true);
  const route = routeHandoff(registry, 'V5_GLOBAL_RESEARCH', 'V6_GLOBAL_SOURCE_INTELLIGENCE', { traceId: 'v5-v6-1' });
  assert.equal(route.traceId, 'v5-v6-1');
});

test('V6 discovers, classifies, resolves identity, evaluates rights and verifies a source', () => {
  const engine = createV6GlobalSourceIntelligenceEngine();
  const original = {
    candidateId: 'candidate-1', sourceUrl: 'https://example.org/book', sourceType: 'DIGITAL_REPOSITORY',
    institution: 'Example Library', language: 'ar', contentHash: 'sha256:abc', canonicalQuranArabic: 'UNCHANGED',
    originalPdf: 'original.pdf', provenance: { retrieval: 'catalog-record', chain: ['catalog', 'repository'] }, rightsState: 'RESTRICTED'
  };
  discoverSource(engine, original);
  classifySource(engine, 'candidate-1', { family: 'UNIVERSITY_LIBRARY', country: 'XX' });
  resolveSourceIdentity(engine, 'candidate-1', { sourceId: 'source:example:book', authority: 'Example Library' });
  evaluateRights(engine, 'candidate-1', 'RESTRICTED', { license: 'catalog-only' });
  const verified = verifySource(engine, 'candidate-1');
  assert.equal(verified.state, 'VERIFIED_SOURCE');
  assert.equal(verified.publishable, false);
  assert.equal(verified.contentHash, original.contentHash);
  assert.equal(verified.canonicalQuranArabic, original.canonicalQuranArabic);
  assert.equal(verified.originalPdf, original.originalPdf);
  assert.equal(isPublishableSource(verified), false);
  assert.equal(engine.sources.size, 1);
});

test('V6 allows publication only when rights are explicitly ALLOWED', () => {
  const engine = createV6GlobalSourceIntelligenceEngine();
  discoverSource(engine, { candidateId: 'candidate-allowed', sourceUrl: 'https://example.org/open', contentHash: 'sha256:open', provenance: { retrieval: 'official-open-record' }, rightsState: 'UNKNOWN' });
  resolveSourceIdentity(engine, 'candidate-allowed', { sourceId: 'source:example:open' });
  evaluateRights(engine, 'candidate-allowed', 'ALLOWED', { license: 'CC-BY' });
  const verified = verifySource(engine, 'candidate-allowed');
  assert.equal(verified.publishable, true);
  assert.equal(isPublishableSource(verified), true);
});

test('V6 deduplicates the same source without replacing its immutable identity', () => {
  const engine = createV6GlobalSourceIntelligenceEngine();
  const base = { sourceUrl: 'https://example.org/same', contentHash: 'sha256:same', provenance: { retrieval: 'official' }, rightsState: 'ALLOWED' };
  discoverSource(engine, { ...base, candidateId: 'a' });
  resolveSourceIdentity(engine, 'a', { sourceId: 'source:same' });
  evaluateRights(engine, 'a', 'ALLOWED', { license: 'CC-BY' });
  const first = verifySource(engine, 'a');
  discoverSource(engine, { ...base, candidateId: 'b' });
  resolveSourceIdentity(engine, 'b', { sourceId: 'source:same' });
  evaluateRights(engine, 'b', 'ALLOWED', { license: 'CC-BY' });
  const second = verifySource(engine, 'b');
  assert.equal(first.sourceId, second.sourceId);
  assert.equal(engine.sources.size, 1);
});

test('V6 links verified sources to work, edition and manuscript identities', () => {
  const engine = createV6GlobalSourceIntelligenceEngine();
  discoverSource(engine, { candidateId: 'candidate-link', sourceUrl: 'https://example.org/manuscript', provenance: { retrieval: 'manuscript-catalog' }, rightsState: 'EXPLICIT_PERMISSION_REQUIRED' });
  resolveSourceIdentity(engine, 'candidate-link', { sourceId: 'source:manuscript:1' });
  evaluateRights(engine, 'candidate-link', 'EXPLICIT_PERMISSION_REQUIRED', { permission: 'pending' });
  verifySource(engine, 'candidate-link');
  const link = linkSourceToWorkEditionManuscript(engine, 'source:manuscript:1', { workId: 'work:1', editionId: 'edition:1', manuscriptId: 'ms:1' });
  assert.equal(link.sourceId, 'source:manuscript:1');
  assert.equal(link.workId, 'work:1');
  assert.equal(link.editionId, 'edition:1');
  assert.equal(link.manuscriptId, 'ms:1');
  assert.equal(v6Health(engine).verifiedSources, 1);
});
