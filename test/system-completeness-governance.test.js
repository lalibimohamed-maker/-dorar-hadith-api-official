import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXTERNAL_STANDARDS,
  createClaimRecord,
  createContributionEntry,
  createEngineRequirement,
  createHistoricalChangeRecord,
  createLineageRecord,
  createResiliencePolicy,
  evaluateDiscoveryCandidate,
  reconcileCandidates,
  systemCompletenessPolicy
} from '../src/system-completeness-governance.js';

test('discovery remains a candidate until source, provenance, rights, validation and review gates pass', () => {
  const blocked = evaluateDiscoveryCandidate({ discoveryOnly: true });
  assert.equal(blocked.accepted, false);

  const accepted = evaluateDiscoveryCandidate({
    sourceId: 'source-1',
    resourceId: 'resource-1',
    url: 'https://example.org/a.pdf',
    citation: 'Edition citation',
    verifiedAt: '2026-09-28T00:00:00Z',
    contentSha256: 'a'.repeat(64),
    rights: { status: 'public-domain' },
    independentValidation: true,
    humanReview: true
  });
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.discoveryIsEvidence, false);
});

test('claims preserve supporting, opposing and uncertainty metadata', () => {
  const claim = createClaimRecord({
    id: 'claim-1',
    statement: 'A documented scholarly position.',
    evidenceIds: ['e-1'],
    supportingEvidenceIds: ['e-1'],
    opposingEvidenceIds: ['e-2'],
    disputed: true,
    uncertainty: { kind: 'interpretive', note: 'Requires review' },
    truthLayer: 'scholarly_ruling'
  });
  assert.deepEqual(claim.evidenceIds, ['e-1', 'e-2']);
  assert.equal(claim.disputed, true);
  assert.equal(claim.corpusMutation, false);
});

test('derived OCR, translation and transformed records preserve lineage and do not replace parents', () => {
  const lineage = createLineageRecord({
    derivedId: 'translation-1',
    parentIds: ['arabic-source-1'],
    transformation: 'translation',
    independentVerification: true
  });
  assert.deepEqual(lineage.parentIds, ['arabic-source-1']);
  assert.equal(lineage.preservesHistoricalParent, true);
  assert.equal(lineage.canonicalReplacement, false);
});

test('duplicate detection is separate from conflict detection', () => {
  const result = reconcileCandidates({
    candidates: [
      { id: 'a', fingerprint: 'same', claims: { language: 'ar' } },
      { id: 'b', fingerprint: 'same', claims: { language: 'ar' } },
      { id: 'c', fingerprint: 'other', claims: { language: 'en' } }
    ]
  });
  assert.equal(result.duplicates.length, 1);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.requiresHumanReview, true);
});

test('withdrawal and replacement preserve historical truth records', () => {
  const record = createHistoricalChangeRecord({
    originalId: 'resource-1',
    event: 'replaced',
    successorId: 'resource-2',
    reason: 'Corrected edition',
    occurredAt: '2026-09-28T00:00:00Z'
  });
  assert.equal(record.eraseHistoricalRecord, false);
});

test('public contributions start in quarantine and cannot mutate the original source', () => {
  const entry = createContributionEntry({
    contributorId: 'public-user',
    targetId: 'book-1',
    payload: { note: 'candidate correction' }
  });
  assert.equal(entry.stage, 'quarantine');
  assert.equal(entry.originalSourceMutation, false);
  assert.throws(() => createContributionEntry({
    contributorId: 'public-user',
    targetId: 'book-1',
    stage: 'accepted'
  }), /reviewer/);
});

test('each capability requires at least two independent engines; a single engine cannot approve it', () => {
  const two = createEngineRequirement({ capability: 'OCR', availableEngines: ['ocr-a', 'ocr-b'] });
  assert.equal(two.satisfiesMinimum, true);
  assert.equal(two.singleEngineApprovalAllowed, false);
  const one = createEngineRequirement({ capability: 'OCR', availableEngines: ['ocr-a'] });
  assert.equal(one.satisfiesMinimum, false);
});

test('resilience includes offline, backup, tested restore, distributed monitoring and safe degradation', () => {
  assert.equal(createResiliencePolicy({
    offlineAvailable: true,
    backupDefined: true,
    restoreTested: true,
    distributedMonitoring: true,
    safeDegrade: true
  }).productionReady, true);
});

test('external standards coordinate interoperability but never become scientific evidence', () => {
  assert.equal(Object.values(EXTERNAL_STANDARDS).every((x) => x.scientificAuthority === false), true);
  const policy = systemCompletenessPolicy();
  assert.equal(policy.externalStandardsAreScientificSources, false);
  assert.equal(policy.wcagTarget, '2.2-AA');
  assert.equal(policy.freeDoesNotMeanPublicDomain, true);
});
