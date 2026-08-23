import assert from 'node:assert/strict';
import test from 'node:test';
import { narratorNetwork, narratorRelations, validateNarratorChain } from '../src/rijal-chain-api.js';

test('chain API preserves source-backed relations', () => {
  const relations = narratorRelations([{ fromNarratorId: 'n:a', toNarratorId: 'n:b', relationType: 'teacher', sourceId: 'r1', reference: '10' }]);
  assert.equal(relations[0].verificationState, 'pending_review');
  assert.equal(narratorNetwork('n:a', relations).students.length, 0);
  assert.equal(validateNarratorChain(['n:a', 'n:b'], relations).valid, true);
});
