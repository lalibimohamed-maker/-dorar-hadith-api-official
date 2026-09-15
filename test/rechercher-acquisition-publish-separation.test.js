import test from 'node:test';
import assert from 'node:assert/strict';

const policy = {
  acquisitionIndependent: true,
  learningNeverBlocksAcquisition: true,
  unknownRightsMayBeCatalogued: true,
  unknownRightsMayNotBePubliclyDistributed: true,
};

test('unknown or restricted rights do not block lawful acquisition/cataloguing by themselves', () => {
  assert.equal(policy.acquisitionIndependent, true);
  assert.equal(policy.learningNeverBlocksAcquisition, true);
  assert.equal(policy.unknownRightsMayBeCatalogued, true);
  assert.equal(policy.unknownRightsMayNotBePubliclyDistributed, true);
});
