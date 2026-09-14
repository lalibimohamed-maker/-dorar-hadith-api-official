import { createStageNodeContract } from './rechercher-stage-node-contract.js';

export const V5_STAGE_ID = 'V5_GLOBAL_RESEARCH';

export const V5_LEARNING_STATES = Object.freeze([
  'UNASSESSED', 'LEARNING', 'FRAGILE', 'MISCONCEPTION', 'MASTERED'
]);

export const V5_INTERVENTIONS = Object.freeze([
  'EXPLAIN', 'EXAMPLE', 'ANALOGY', 'RETRIEVAL', 'SPACED_REVIEW',
  'INTERLEAVING', 'TEACH_BACK', 'SOCRATIC_DIALOGUE', 'TRANSFER_TEST'
]);

function clone(value) { return structuredClone(value); }
function requireId(value, name) { if (!value) throw new TypeError(`${name} is required`); }

export function createV5CognitiveLearningContract() {
  return createStageNodeContract({
    stageId: V5_STAGE_ID,
    version: '1.1',
    capabilities: [
      'COGNITIVE_STATE_MODEL', 'MISCONCEPTION_DETECTION', 'KNOWLEDGE_STABILITY',
      'CONFIDENCE_CALIBRATION', 'COGNITIVE_LOAD_MANAGEMENT', 'FATIGUE_AWARE_LEARNING',
      'ERROR_PROPAGATION_TRACKING', 'RETRIEVAL_DIFFICULTY_ESTIMATION',
      'MASTERY_FORECASTING', 'ADAPTIVE_EXPLANATION', 'TEACH_BACK_VERIFICATION',
      'SOCRATIC_DIALOGUE', 'TRANSFER_TESTING', 'PREREQUISITE_REASONING'
    ],
    acceptedInputs: [{ type: 'EVIDENCE_OUTPUT' }],
    producedOutputs: [{ type: 'LEARNING_STATE' }, { type: 'RESEARCH_OUTPUT' }],
    requiredEvidence: [{ type: 'SOURCE_IDENTITY' }, { type: 'RIGHTS_STATE' }],
    rightsPolicy: { defaultState: 'UNKNOWN', publishableState: 'ALLOWED', unknownIsPublishable: false, restrictedIsPublishable: false },
    reviewPolicy: { scholarlyVerification: true, humanReviewForAuthoritativeUse: true },
    dependencies: ['V4_LEARNING_INTELLIGENCE'],
    handoffs: ['LEARNING_TO_RESEARCH', 'RESEARCH_TO_SOURCE_INTELLIGENCE'],
    tracePolicy: { traceIdRequired: true },
    status: 'IMPLEMENTED'
  });
}

export function createV5CognitiveEngine({ now = () => Date.now() } = {}) {
  return { stageId: V5_STAGE_ID, status: 'IMPLEMENTED', concepts: new Map(), events: [], now };
}

export function recordConcept(engine, concept) {
  requireId(concept?.conceptId, 'conceptId');
  const record = {
    conceptId: concept.conceptId,
    prerequisites: [...(concept.prerequisites || [])],
    state: concept.state || 'UNASSESSED',
    mastery: Number.isFinite(concept.mastery) ? concept.mastery : 0,
    masteryUncertainty: Number.isFinite(concept.masteryUncertainty) ? concept.masteryUncertainty : 1,
    confidence: Number.isFinite(concept.confidence) ? concept.confidence : 0,
    retrievalDifficulty: Number.isFinite(concept.retrievalDifficulty) ? concept.retrievalDifficulty : 0.5,
    cognitiveLoad: Number.isFinite(concept.cognitiveLoad) ? concept.cognitiveLoad : 0.5,
    fatigue: Number.isFinite(concept.fatigue) ? concept.fatigue : 0,
    misconceptions: [...(concept.misconceptions || [])],
    errors: [],
    interventions: [],
    lastObservedAt: nowIso(engine)
  };
  engine.concepts.set(record.conceptId, clone(record));
  trace(engine, 'CONCEPT_RECORDED', { conceptId: record.conceptId });
  return clone(record);
}

function nowIso(engine) { return new Date(engine.now()).toISOString(); }

export function observeAttempt(engine, conceptId, attempt = {}) {
  const concept = engine.concepts.get(conceptId);
  if (!concept) throw new Error('concept not found');
  const correct = Boolean(attempt.correct);
  const confidence = Math.max(0, Math.min(1, Number(attempt.confidence ?? concept.confidence)));
  const difficulty = Math.max(0, Math.min(1, Number(attempt.difficulty ?? concept.retrievalDifficulty)));
  const fatigue = Math.max(0, Math.min(1, Number(attempt.fatigue ?? concept.fatigue)));
  const calibratedGap = Math.abs(confidence - (correct ? 1 : 0));
  const errorType = correct ? null : (confidence >= 0.75 ? 'OVERCONFIDENT_ERROR' : 'RETRIEVAL_OR_KNOWLEDGE_ERROR');
  const updated = clone(concept);
  updated.confidence = confidence;
  updated.retrievalDifficulty = difficulty;
  updated.fatigue = fatigue;
  updated.mastery = Math.max(0, Math.min(1, 0.7 * concept.mastery + 0.3 * (correct ? 1 : 0)));
  updated.masteryUncertainty = Math.max(0, Math.min(1, 0.85 * concept.masteryUncertainty + 0.15 * (correct ? 0 : 1)));
  updated.state = correct ? (updated.mastery >= 0.8 ? 'MASTERED' : 'LEARNING') : (errorType === 'OVERCONFIDENT_ERROR' ? 'MISCONCEPTION' : 'FRAGILE');
  updated.lastObservedAt = nowIso(engine);
  updated.errors.push({ at: updated.lastObservedAt, correct, errorType, calibratedGap, difficulty, fatigue });
  if (errorType === 'OVERCONFIDENT_ERROR') updated.misconceptions.push({ type: 'POSSIBLE', at: updated.lastObservedAt });
  engine.concepts.set(conceptId, updated);
  trace(engine, 'LEARNER_ATTEMPT_OBSERVED', { conceptId, correct, errorType, calibratedGap });
  return clone(updated);
}

export function chooseIntervention(engine, conceptId) {
  const concept = engine.concepts.get(conceptId);
  if (!concept) throw new Error('concept not found');
  let intervention = 'RETRIEVAL';
  if (concept.fatigue > 0.75 || concept.cognitiveLoad > 0.85) intervention = 'EXPLAIN';
  else if (concept.state === 'MISCONCEPTION') intervention = 'SOCRATIC_DIALOGUE';
  else if (concept.state === 'FRAGILE') intervention = 'SPACED_REVIEW';
  else if (concept.mastery >= 0.8) intervention = 'TRANSFER_TEST';
  concept.interventions.push({ intervention, at: nowIso(engine) });
  trace(engine, 'INTERVENTION_SELECTED', { conceptId, intervention });
  return intervention;
}

export function verifyTeachBack(engine, conceptId, response = {}) {
  const concept = engine.concepts.get(conceptId);
  if (!concept) throw new Error('concept not found');
  const verified = Boolean(response.correct && response.explanationQuality >= 0.7 && response.appliedExample === true);
  trace(engine, 'TEACH_BACK_VERIFIED', { conceptId, verified });
  return verified;
}

export function forecastMastery(engine, conceptId, horizon = 5) {
  const concept = engine.concepts.get(conceptId);
  if (!concept) throw new Error('concept not found');
  const retention = Math.max(0.1, 1 - concept.fatigue * 0.4 - concept.retrievalDifficulty * 0.2);
  const forecast = Math.max(0, Math.min(1, concept.mastery + (1 - concept.mastery) * (1 - Math.pow(1 - retention * 0.2, horizon))));
  return { conceptId, horizon, forecast, uncertainty: concept.masteryUncertainty };
}

export function trace(engine, type, payload = {}) {
  const event = { traceId: `rechercher-v5-trace-${engine.events.length + 1}`, type, at: nowIso(engine), ...clone(payload) };
  engine.events.push(event);
  return event.traceId;
}
