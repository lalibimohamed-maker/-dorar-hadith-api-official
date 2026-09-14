import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMemoryState,
  recordFeedbackSignal,
  summarizeSession,
  createCrossDomainGraph,
  addCrossDomainEdge,
  findTransferRoutes,
  evaluateTransfer,
  applyPedagogicalSafety,
  canLearningBlockAcquisition,
} from '../src/learning/rechercher-learning-intelligence-v4.mjs';

test('v4 separates ephemeral session memory from long-term learner memory', () => {
  let memory = createMemoryState({ session: { sessionId: 's1', currentSkillId: 'hadith' }, longTerm: { learnerId: 'u1' } });
  memory = recordFeedbackSignal(memory, { type: 'hesitation', skillId: 'hadith', value: 1 });
  assert.equal(memory.session.recentSignals.length, 1);
  memory = summarizeSession(memory, { skillId: 'hadith', mastery: 0.72, confidence: 0.8, calibration: { state: 'overconfident' } });
  assert.equal(memory.session.recentSignals.length, 0);
  assert.equal(memory.longTerm.skills.hadith.mastery, 0.72);
  assert.equal(memory.longTerm.calibration.state, 'overconfident');
});

test('v4 feedback buffer accepts micro-interaction signals without forcing persistence', () => {
  const memory = recordFeedbackSignal(createMemoryState(), { type: 'pause', itemId: 'q1', value: 3200 });
  assert.equal(memory.session.recentSignals[0].type, 'pause');
  assert.equal(memory.session.recentSignals[0].value, 3200);
});

test('v4 cross-domain graph exposes evidence-ranked transfer routes', () => {
  const graph = createCrossDomainGraph({
    domains: { quran: {}, arabic: {} },
    skills: {
      tajweed: { domain: 'quran' },
      phonology: { domain: 'arabic' },
    },
  });
  const next = addCrossDomainEdge(graph, { from: 'tajweed', to: 'phonology', relation: 'supports', confidence: 0.9, evidence: ['e1'] });
  assert.equal(findTransferRoutes(next, 'tajweed', 'arabic')[0].confidence, 0.9);
  const result = evaluateTransfer({ sourceSkill: 'tajweed', targetSkill: 'phonology', result: { correct: true, score: 0.8, sourceGrounded: true }, confidence: 0.7 });
  assert.equal(result.status, 'demonstrated');
  assert.equal(result.evidenceLevel, 'source-grounded');
});

test('v4 safety scaffolds before revealing an answer when struggle is detected', () => {
  const safe = applyPedagogicalSafety({ response: 'answer', learnerState: { struggling: true }, context: { directAnswer: true } });
  assert.equal(safe.action, 'scaffold-first');
  assert.equal(safe.avoidDirectAnswer, true);
  assert.equal(safe.allowed, false);
  const ready = applyPedagogicalSafety({ response: 'hint', learnerState: { struggling: true }, context: { directAnswer: true, scaffolded: true } });
  assert.equal(ready.allowed, true);
});

test('v4 cannot block PDF acquisition', () => {
  assert.equal(canLearningBlockAcquisition(), false);
});
