import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSourceFederationEngine,
  registerFederationProvider,
  registerWork,
  registerManifestation,
  rankManifestations,
  buildAcquisitionFallback,
  recordAttempt,
  recordGap,
  bestManifestation
} from '../src/rechercher-global-source-federation-v2-engine.js';

test('registers providers and preserves lawful fallback', () => {
  const e = createSourceFederationEngine();
  registerFederationProvider(e, { id: 'iiif', engines: ['MANIFEST', 'CANVAS'] });
  registerFederationProvider(e, { id: 'openalex', engines: ['WORK', 'OA'] });
  assert.deepEqual(buildAcquisitionFallback(e, 'w1', ['iiif']).map(x => x.providerId), ['openalex']);
});

test('preserves immutable work identity and rejects conflicting identity', () => {
  const e = createSourceFederationEngine();
  registerWork(e, { workId: 'w1', sourceIdentity: 'source:1' });
  assert.throws(() => registerWork(e, { workId: 'w1', sourceIdentity: 'source:2' }), /immutable source identity conflict/);
});

test('preserves manifestation content hash and ranks quality', () => {
  const e = createSourceFederationEngine();
  registerWork(e, { workId: 'w1', sourceIdentity: 'source:1' });
  registerManifestation(e, { manifestationId: 'm1', workId: 'w1', contentHash: 'sha256:a', rightsState: 'ALLOWED', identityMatch: 1, editionMatch: 1, completeness: 1, pageImageQuality: .9, pdfIntegrity: 1, provenanceStrength: 1, rightsClarity: 1, sourceAuthority: 1, downloadability: 1 });
  registerManifestation(e, { manifestationId: 'm2', workId: 'w1', contentHash: 'sha256:b', rightsState: 'ALLOWED', identityMatch: .7, editionMatch: .7 });
  assert.equal(rankManifestations(e, 'w1')[0].manifestationId, 'm1');
  assert.equal(bestManifestation(e, 'w1').manifestationId, 'm1');
});

test('rights-unknown manifestation is never selected as best public manifestation', () => {
  const e = createSourceFederationEngine();
  registerWork(e, { workId: 'w1', sourceIdentity: 'source:1' });
  registerManifestation(e, { manifestationId: 'm1', workId: 'w1', contentHash: 'sha256:a', rightsState: 'UNKNOWN', identityMatch: 1, completeness: 1 });
  assert.equal(bestManifestation(e, 'w1'), null);
});

test('records attempts and gaps without stopping acquisition', () => {
  const e = createSourceFederationEngine();
  registerFederationProvider(e, { id: 'p1', engines: ['CATALOG'] });
  recordAttempt(e, { workId: 'w1', providerId: 'p1', outcome: 'NO_MATCH' });
  recordGap(e, { workId: 'w1', type: 'NO_MATCH' });
  assert.equal(e.attempts.length, 1);
  assert.equal(e.gaps.length, 1);
});
