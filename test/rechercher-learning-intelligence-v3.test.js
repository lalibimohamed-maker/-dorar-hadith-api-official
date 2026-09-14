import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createGraphState,
  addGraphNode,
  addGraphEdge,
  prerequisiteGaps,
  diagnoseMisconception,
  calibrate,
  createMultimodalProfile,
  recordMethodOutcome,
  evaluateMethod,
  compareMethods,
  buildV3Decision,
  canLearningBlockAcquisition,
} from '../src/learning/rechercher-learning-intelligence-v3.mjs';

test('v3 builds knowledge/evidence/prerequisite graph primitives', () => {
  let g = createGraphState();
  g = addGraphNode(g, { id: 'a', type: 'knowledge' });
  g = addGraphNode(g, { id: 'b', type: 'knowledge' });
  g = addGraphEdge(g, { from: 'a', to: 'b', relation: 'requires', confidence: 0.9 });
  const gaps = prerequisiteGaps(g, { skills: { a: { mastery: 0.2 } } }, 'b');
  assert.equal(gaps.length, 1);
});

test('v3 detects candidate misconceptions without declaring them as facts', () => {
  let g = createGraphState();
  g = addGraphNode(g, { id: 'skill', type: 'knowledge' });
  g = addGraphNode(g, { id: 'mis', type: 'misconception' });
  g = addGraphEdge(g, { from: 'skill', to: 'mis', relation: 'caused_by', confidence: 0.8 });
  const result = diagnoseMisconception(g, { misconceptions: { mis: true } }, 'skill', { correct: false });
  assert.equal(result.id, 'mis');
  assert.equal(result.confidence, 0.8);
});

test('v3 separates confidence from correctness through calibration', () => {
  assert.equal(calibrate({ correct: false, confidence: 0.9 }).state, 'overconfident');
  assert.equal(calibrate({ correct: true, confidence: 0.1 }).state, 'underconfident');
});

test('v3 creates a privacy-minimal multimodal learner profile', () => {
  const p = createMultimodalProfile({ audio: { proficiency: 0.7, attempts: 4 } });
  assert.equal(p.audio.proficiency, 0.7);
  assert.equal(p.audio.attempts, 4);
  assert.ok(!('biometrics' in p));
});

test('v3 records outcomes and compares methods only from observed evidence', () => {
  let r = {};
  for (let i = 0; i < 10; i += 1) r = recordMethodOutcome(r, { methodId: 'retrieval', immediate: 0.8, delayed: 0.75, transfer: 0.7, timeMs: 1000 });
  assert.equal(evaluateMethod(r, 'retrieval').status, 'eligible-for-comparison');
  assert.equal(compareMethods(r, ['retrieval'])[0].transferMean, 0.7);
});

test('v3 integrates graph diagnosis, calibration and method evidence', () => {
  let g = createGraphState();
  g = addGraphNode(g, { id: 'pre', type: 'knowledge' });
  g = addGraphNode(g, { id: 'skill', type: 'knowledge' });
  g = addGraphEdge(g, { from: 'pre', to: 'skill', relation: 'requires', confidence: 0.95 });
  const decision = buildV3Decision({
    graph: g,
    state: { skills: { pre: { mastery: 0.2 } }, calibrationBias: 0 },
    skillId: 'skill',
    result: { correct: false, confidence: 0.9 },
    methods: ['retrieval'],
    methodRegistry: {},
  });
  assert.equal(decision.diagnosis.prerequisiteGap, true);
  assert.equal(decision.diagnosis.calibration.state, 'overconfident');
  assert.equal(decision.acquisitionIndependent, true);
});

test('learning and graph failures can never block PDF acquisition', () => {
  assert.equal(canLearningBlockAcquisition(), false);
});
