'use strict';

const STAGES = Object.freeze([
  'V1_FOUNDATION','V2_FEDERATION','V3_DOMAIN_LEARNING','V4_LEARNING_INTELLIGENCE','V5_GLOBAL_RESEARCH',
  'V6_GLOBAL_SOURCE_INTELLIGENCE','V7_GLOBAL_RESEARCH_GRAPH','V8_AUTONOMOUS_ADAPTIVE_LEARNING',
  'V9','V10','V11','V12','V13','V14','V15','V16','V17','V18','V19','V20',
  'V21','V22','V23','V24','V25','V26','V27','V28','V29','V30','V31_PLUS'
]);

const STATUS = Object.freeze([
  'MISSING','PLANNED','OPEN_EXTENSION_POINT','PARTIAL','IMPLEMENTED_FOUNDATION','IMPLEMENTED','COMPLETE'
]);

const HARD_GATES = Object.freeze([
  'engine','resources','contracts','inputs','outputs','handoffs','tests','integration','provenance','rights','immutability','security','governance','observability'
]);

function assertStage(stage) {
  if (!STAGES.includes(stage)) throw new Error(`Unknown Rechercher stage: ${stage}`);
}

function normalizeStatus(status) {
  if (!STATUS.includes(status)) throw new Error(`Unknown completion status: ${status}`);
  return status;
}

function createStageRecord(stage, input = {}) {
  assertStage(stage);
  const gates = {};
  for (const gate of HARD_GATES) gates[gate] = input.gates?.[gate] === true;
  return {
    stage,
    status: normalizeStatus(input.status || 'MISSING'),
    gates,
    evidence: Array.isArray(input.evidence) ? [...input.evidence] : [],
    gaps: Array.isArray(input.gaps) ? [...input.gaps] : [],
    dependencies: Array.isArray(input.dependencies) ? [...input.dependencies] : [],
    extensions: Array.isArray(input.extensions) ? [...input.extensions] : []
  };
}

function isStageComplete(record) {
  if (!record || !STAGES.includes(record.stage)) return false;
  if (record.status !== 'COMPLETE') return false;
  return HARD_GATES.every(gate => record.gates?.[gate] === true) && record.gaps.length === 0;
}

function buildGlobalCompletionReport(records = []) {
  const byStage = new Map(records.map(record => [record.stage, record]));
  const stages = STAGES.map(stage => byStage.get(stage) || createStageRecord(stage));
  const complete = stages.filter(isStageComplete).length;
  const blocked = stages.filter(record => !isStageComplete(record));
  return {
    engine: 'rechercher-global-lifecycle-completion',
    version: '2.0.0',
    scope: 'V1_TO_V31_PLUS',
    stages,
    summary: {
      totalStages: STAGES.length,
      completeStages: complete,
      incompleteStages: blocked.length,
      operationalCompletionPercent: Number(((complete / STAGES.length) * 100).toFixed(2)),
      globalOperationalComplete: complete === STAGES.length
    },
    policy: {
      noFalseComplete: true,
      documentationAloneNeverCounts: true,
      futureStagesRemainTracked: true,
      v31PlusIsOpenEnded: true,
      sourceRightsCannotBeOverridden: true,
      originalPdfImmutable: true,
      canonicalQuranArabicImmutable: true,
      aiCannotSelfVerify: true
    }
  };
}

function assertNoFalseComplete(report) {
  for (const stage of report.stages) {
    if (stage.status === 'COMPLETE' && !isStageComplete(stage)) {
      throw new Error(`False COMPLETE status for ${stage.stage}`);
    }
  }
  return true;
}

function createGlobalLifecycleCompletionEngine() {
  return {
    version: '2.0.0',
    stages: [...STAGES],
    gates: [...HARD_GATES],
    createStageRecord,
    buildGlobalCompletionReport,
    isStageComplete,
    assertNoFalseComplete
  };
}

module.exports = {
  STAGES,
  STATUS,
  HARD_GATES,
  createStageRecord,
  buildGlobalCompletionReport,
  isStageComplete,
  assertNoFalseComplete,
  createGlobalLifecycleCompletionEngine
};
