import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createIsnad,
  createNarratorRegistry,
  registerNarrator,
  summarizeNarratorEvidence,
  validateIsnad,
  validateNarrator
} from '../src/hadith-isnad.js';

test('validates the minimum narrator identity', () => {
  assert.equal(validateNarrator({ id: 'n1', name: 'Narrator' }).valid, true);
  assert.equal(validateNarrator({ id: 'n1' }).valid, false);
});

test('rejects duplicate narrator identities', () => {
  const registry = createNarratorRegistry([{ id: 'n1', name: 'Narrator' }]);
  assert.throws(() => registerNarrator(registry, { id: 'n1', name: 'Other' }), /Duplicate narrator/);
});

test('requires every isnad narrator to be registered', () => {
  const registry = createNarratorRegistry([{ id: 'n1', name: 'Narrator' }]);
  assert.equal(validateIsnad({ id: 'i1', narratorIds: ['n1'] }, registry).valid, true);
  assert.equal(validateIsnad({ id: 'i2', narratorIds: ['missing'] }, registry).valid, false);
});

test('creates only validated isnad structures', () => {
  const registry = createNarratorRegistry([{ id: 'n1', name: 'Narrator' }]);
  const isnad = createIsnad(registry, { id: 'i1', narratorIds: ['n1'] });
  assert.deepEqual(isnad.narratorIds, ['n1']);
  assert.throws(() => createIsnad(registry, { id: 'i2', narratorIds: ['missing'] }), /narrator-not-registered/);
});

test('summarizes narrator evidence without issuing a new scholarly grade', () => {
  const summary = summarizeNarratorEvidence({
    id: 'n1', name: 'Narrator',
    grades: [{ sourceId: 'rijal-1', grade: 'thiqah' }, { sourceId: 'rijal-2', grade: 'saduq' }]
  });
  assert.deepEqual(summary, { narratorId: 'n1', gradeCount: 2, sources: ['rijal-1', 'rijal-2'] });
});
