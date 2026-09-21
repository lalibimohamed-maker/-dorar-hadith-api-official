import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createClaim,
  createEvidence,
  createContradiction,
  linkEvidence,
  linkContradiction,
  verifyClaim,
  buildResearchGraph,
} from '../src/rechercher-claim-evidence-contradiction-engine.js';

const provenance = {
  sourceIds: ['source:test:primary'],
  retrievalDate: '2026-09-14',
};

test('creates a provenance-backed direct-source claim', () => {
  const claim = createClaim({
    claimId: 'claim:1',
    text: 'A source-backed statement',
    status: 'DIRECT_SOURCE',
    provenance,
  });
  assert.equal(claim.status, 'DIRECT_SOURCE');
});

test('rejects claims without provenance', () => {
  assert.throws(() => createClaim({ claimId: 'claim:1', text: 'x' }), /provenance is required/);
});

test('links evidence only to the matching claim', () => {
  const claim = createClaim({ claimId: 'claim:1', text: 'x', provenance });
  const evidence = createEvidence({ evidenceId: 'evidence:1', claimId: 'claim:1', strength: 'DIRECT', provenance });
  assert.deepEqual(linkEvidence(claim, evidence), {
    claimId: 'claim:1', evidenceId: 'evidence:1', relation: 'SUPPORTED_BY',
  });
});

test('requires scholarly review before verification', () => {
  const claim = createClaim({ claimId: 'claim:1', text: 'x', status: 'DIRECT_SOURCE', provenance });
  const evidence = createEvidence({ evidenceId: 'evidence:1', claimId: 'claim:1', strength: 'DIRECT', provenance });
  assert.throws(() => verifyClaim(claim, [evidence], { reviewState: 'UNREVIEWED' }), /scholarly review/);
  assert.equal(verifyClaim(claim, [evidence], { reviewState: 'SCHOLAR_REVIEWED' }).reviewState, 'VERIFIED');
});

test('AI synthesis cannot become verified by itself', () => {
  const claim = createClaim({ claimId: 'claim:ai', text: 'generated', status: 'AI_SYNTHESIS', provenance });
  const evidence = createEvidence({ evidenceId: 'evidence:ai', claimId: 'claim:ai', strength: 'STRONG', provenance });
  assert.throws(() => verifyClaim(claim, [evidence], { reviewState: 'SCHOLAR_REVIEWED' }), /AI-generated/);
});

test('records contradiction without silently resolving it', () => {
  const left = createClaim({ claimId: 'claim:left', text: 'left', provenance });
  const right = createClaim({ claimId: 'claim:right', text: 'right', provenance });
  const contradiction = createContradiction({
    contradictionId: 'contradiction:1',
    leftClaimId: left.claimId,
    rightClaimId: right.claimId,
    confidence: 0.7,
    provenance,
  });
  assert.equal(contradiction.reviewState, 'REVIEW_REQUIRED');
  assert.deepEqual(linkContradiction(left, right, contradiction).endpoints, ['claim:left', 'claim:right']);
});

test('builds graph only when endpoints exist', () => {
  const claim = createClaim({ claimId: 'claim:1', text: 'x', provenance });
  const evidence = createEvidence({ evidenceId: 'evidence:1', claimId: 'claim:1', strength: 'DIRECT', provenance });
  const graph = buildResearchGraph({ claims: [claim], evidences: [evidence] });
  assert.equal(graph.edges.length, 1);
  assert.throws(() => buildResearchGraph({ claims: [], evidences: [evidence] }), /missing claim endpoint/);
});
