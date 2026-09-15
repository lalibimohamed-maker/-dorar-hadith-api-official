'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  STAGES,
  HARD_GATES,
  createStageRecord,
  buildGlobalCompletionReport,
  isStageComplete,
  assertNoFalseComplete
} = require('../src/rechercher-global-lifecycle-completion-engine');

test('tracks every stage from V1 through V31+', () => {
  assert.equal(STAGES.length, 31);
  assert.equal(STAGES[0], 'V1_FOUNDATION');
  assert.equal(STAGES.at(-1), 'V31_PLUS');
});

test('does not mark a stage complete without every hard gate', () => {
  const record = createStageRecord('V8_AUTONOMOUS_ADAPTIVE_LEARNING', {
    status: 'COMPLETE',
    gates: Object.fromEntries(HARD_GATES.map(gate => [gate, true]))
  });
  record.gaps.push('missing global source expansion');
  assert.equal(isStageComplete(record), false);
  assert.throws(() => assertNoFalseComplete(buildGlobalCompletionReport([record])), /False COMPLETE/);
});

test('V31+ remains a tracked open-ended stage rather than disappearing from the gate', () => {
  const report = buildGlobalCompletionReport([
    createStageRecord('V31_PLUS', { status: 'OPEN_EXTENSION_POINT' })
  ]);
  assert.equal(report.scope, 'V1_TO_V31_PLUS');
  assert.equal(report.summary.globalOperationalComplete, false);
  assert.equal(report.policy.v31PlusIsOpenEnded, true);
});
