import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EDITION_TYPES,
  JURISDICTIONS,
  RIGHTS_DECISIONS,
  classifyEdition,
  classifyRightsEvidence,
  publicDomainByDeath
} from '../src/rechercher-rights-engine.js';

test('Algerian 50-year term marks an old author work public domain', () => {
  const result = publicDomainByDeath(1956, JURISDICTIONS.DZ, 2026);
  assert.equal(result.publicDomain, true);
  assert.equal(result.publicDomainYear, 2007);
});

test('recent author work stays protected', () => {
  const result = publicDomainByDeath(1990, JURISDICTIONS.DZ, 2026);
  assert.equal(result.publicDomain, false);
});

test('public-domain work with modern editor is held for edition review', () => {
  const result = classifyEdition({
    authorDeathYear: 1956,
    author: 'عبد الرحمن السعدي',
    editor: 'محقق معاصر',
    publisher: 'دار نشر',
    editionYear: 2002,
    editionType: EDITION_TYPES.CRITICAL_EDITION
  }, { jurisdiction: JURISDICTIONS.DZ, asOfYear: 2026 });
  assert.equal(result.workStatus.publicDomain, true);
  assert.equal(result.decision, RIGHTS_DECISIONS.WORK_PD_EDITION_REVIEW);
  assert.equal(result.editionNeedsReview, true);
});

test('explicit Creative Commons licensing can clear edition reuse', () => {
  const result = classifyEdition({
    authorDeathYear: 1956,
    license: 'CC BY 4.0',
    explicitRedistribution: true,
    editionYear: 2002
  }, { jurisdiction: JURISDICTIONS.DZ, asOfYear: 2026 });
  assert.equal(result.decision, RIGHTS_DECISIONS.LICENSED);
});

test('free download signal is not redistribution permission', () => {
  const result = classifyRightsEvidence([{ kind: 'read-copy-permission' }]);
  assert.equal(result.decision, RIGHTS_DECISIONS.READ_ONLY);
});

test('conflicting explicit and blocking evidence fails closed', () => {
  const result = classifyRightsEvidence([
    { kind: 'explicit-redistribution-permission' },
    { kind: 'copyright-reservation' }
  ]);
  assert.equal(result.decision, RIGHTS_DECISIONS.CONFLICT);
  assert.equal(result.conflict, true);
});
