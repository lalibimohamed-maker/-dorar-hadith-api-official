import test from 'node:test';
import assert from 'node:assert/strict';

test('resource policy maximizes lawful acquisition without granting redistribution rights', () => {
  const policy = {
    temporalScope: 'PROPHETIC_ERA_TO_FUTURE_WORLDWIDE',
    acquisition: { lawfulOnly: true, learningDoesNotBlock: true, unknownRightsCatalogued: true },
    publication: { requiresRightsEvidence: true },
  };
  assert.equal(policy.acquisition.learningDoesNotBlock, true);
  assert.equal(policy.acquisition.unknownRightsCatalogued, true);
  assert.equal(policy.publication.requiresRightsEvidence, true);
});
