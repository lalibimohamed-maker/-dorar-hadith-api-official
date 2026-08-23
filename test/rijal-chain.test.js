import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNarratorRelation, getNarratorNetwork, normalizeNarratorName, validateChain } from '../src/rijal-chain.js';

test('normalizes common Arabic narrator name variants for lookup only', () => {
  assert.equal(normalizeNarratorName('إبْنُ عُمَر'), 'ابن عمر');
  assert.equal(normalizeNarratorName('ابن  عمر'), 'ابن عمر');
});

test('requires source evidence for narrator relations', () => {
  const relation = buildNarratorRelation({
    fromNarratorId: 'n:teacher',
    toNarratorId: 'n:student',
    relationType: 'teacher',
    sourceId: 'rijal-book',
    reference: 'p. 10',
    evidenceText: 'روى عن'
  });
  assert.equal(relation.verificationState, 'pending_review');
  assert.throws(() => buildNarratorRelation({
    fromNarratorId: 'n:a', toNarratorId: 'n:b', relationType: 'teacher'
  }), /Invalid narrator relation/);
});

test('builds teacher/student network without synthesizing a verdict', () => {
  const relations = [
    buildNarratorRelation({ fromNarratorId: 'n:a', toNarratorId: 'n:b', relationType: 'teacher', sourceId: 'r1', reference: '1' }),
    buildNarratorRelation({ fromNarratorId: 'n:a', toNarratorId: 'n:c', relationType: 'student', sourceId: 'r2', reference: '2' })
  ];
  const network = getNarratorNetwork('n:a', relations);
  assert.equal(network.teachers.length, 0);
  assert.equal(network.students.length, 1);
});

test('chain validation only reports missing linked evidence', () => {
  const relations = [
    buildNarratorRelation({ fromNarratorId: 'n:a', toNarratorId: 'n:b', relationType: 'teacher', sourceId: 'r1', reference: '1' })
  ];
  assert.equal(validateChain(['n:a', 'n:b'], relations).valid, true);
  const missing = validateChain(['n:a', 'n:b', 'n:c'], relations);
  assert.equal(missing.valid, false);
  assert.equal(missing.errors[0].reason, 'no-linked-evidence');
});
