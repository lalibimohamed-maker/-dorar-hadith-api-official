import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeachBackEngine, createTeachBackPrompt, submitTeachBack, reviewTeachBack } from '../src/rechercher-teachback-engine.js';

test('teach-back supports source-linked learner response and human feedback', () => {
  const e = createTeachBackEngine();
  createTeachBackPrompt(e, { promptId: 'p1', learnerId: 'u1', conceptId: 'c1', sourceIds: ['s1'] });
  submitTeachBack(e, { responseId: 'r1', promptId: 'p1', text: 'شرح المتعلم', sourceIds: ['s1'] });
  const feedback = reviewTeachBack(e, { responseId: 'r1', reviewerId: 'teacher1', feedbackType: 'PARTIAL', note: 'زد الدليل', sourceIds: ['s1'] });
  assert.equal(feedback.feedbackType, 'PARTIAL');
  assert.equal(e.responses.get('r1').status, 'PARTIAL');
});
