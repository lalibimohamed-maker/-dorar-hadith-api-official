import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadLearningGapRegister,
  validateLearningGapRegister,
  gapsByPriority,
  assertAcquisitionIndependent,
  summarizeLearningGaps
} from '../src/learning/learning-gap-register.mjs';

test('learning gap register has all 17 targets and no acquisition blockers', () => {
  const register = loadLearningGapRegister();
  assert.equal(validateLearningGapRegister(register).ok, true);
  assert.equal(assertAcquisitionIndependent(register), true);
  assert.equal(register.gaps.length, 17);
});

test('priority counts match the frozen roadmap', () => {
  const register = loadLearningGapRegister();
  assert.equal(gapsByPriority('P0', register).length, 4);
  assert.equal(gapsByPriority('P1', register).length, 6);
  assert.equal(gapsByPriority('P2', register).length, 3);
  assert.equal(gapsByPriority('P3', register).length, 2);
  assert.equal(gapsByPriority('P4', register).length, 2);
});

test('summary exposes implementation state without pretending future work is done', () => {
  const summary = summarizeLearningGaps();
  assert.equal(summary.P1.some(g => g.status === 'planned'), true);
  assert.equal(summary.P0.every(g => g.status === 'implemented-in-p0'), true);
});
