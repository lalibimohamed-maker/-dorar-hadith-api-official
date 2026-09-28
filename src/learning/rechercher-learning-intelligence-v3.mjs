/**
 * Rechercher Learning Intelligence Engine v3.
 *
 * This module provides graph-grounded learning intelligence primitives.
 * It is downstream of acquisition and cannot become an acquisition gate.
 */

export const V3_VERSION = '3.0.0';

export const GRAPH_TYPES = Object.freeze([
  'knowledge',
  'source',
  'author',
  'work',
  'edition',
  'chapter',
  'passage',
  'claim',
  'concept',
  'evidence',
  'narrator',
  'hadith',
  'event',
  'place',
  'school',
  'scholar',
  'commentary',
  'translation',
  'learning-item',
  'prerequisite',
  'misconception',
  'learner'
]);

export const RELATIONS = Object.freeze([
  'related_to',
  'explains',
  'supports',
  'contrasts_with',
  'example_of',
  'derived_from',
  'prerequisite_of',
  'requires',
  'strongly_requires',
  'recommended_before',
  'parallel_to',
  'advanced_form_of',
  'depends_on',
  'triggered_by',
  'causes_error_in',
  'caused_by',
  'confused_with',
  'contradicts',
  'corrected_by',
  're_test_with',
  'retested_by'
]);

export const GRAPH_EDGE_STATUSES = Object.freeze([
  'candidate',
  'verified',
  'disputed',
  'learner-observation'
]);

export const FAILURE_TYPES = Object.freeze([
  'memory-failure',
  'terminology-confusion',
  'source-attribution-error',
  'contextual-misunderstanding',
  'scholarly-disagreement',
  'conceptual-misconception',
  'unknown'
]);

export const METHOD_STAGES = Object.freeze([
  'acquisition',
  'initial-learning',
  'practice',
  'consolidation',
  'transfer',
  'assessment'
]);

const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number(n) || 0));
const asArray = value => Array.isArray(value) ? value : [];
const unique = value => [...new Set(asArray(value).filter(Boolean))];
const round = (n, digits = 6) => Number(Number(n).toFixed(digits));
const mean = values => {
  const finite = asArray(values).filter(Number.isFinite);
  return finite.length ? round(finite.reduce((a, b) => a + b, 0) / finite.length) : null;
};

const EDGE_REQUIRE_PROVENANCE = new Set([
  'supports', 'explains', 'contrasts_with', 'example_of', 'derived_from',
  'prerequisite_of', 'requires', 'strongly_requires', 'recommended_before',
  'parallel_to', 'advanced_form_of', 'depends_on', 'triggered_by',
  'causes_error_in', 'caused_by', 'confused_with', 'contradicts',
  'corrected_by', 're_test_with', 'retested_by'
]);

function validProvenance(provenance = {}) {
  return Boolean(
    provenance &&
    provenance.sourceId &&
    (provenance.anchor || provenance.page || provenance.location)
  );
}

export function createGraphState(input = {}) {
  return {
    version: V3_VERSION,
    nodes: { ...(input.nodes || {}) },
    edges: asArray(input.edges).map(edge => ({ ...edge })),
    reviewQueue: [...asArray(input.reviewQueue)]
  };
}

export function addGraphNode(graph, node) {
  if (!node?.id || !node?.type || !GRAPH_TYPES.includes(node.type)) {
    throw new Error('invalid graph node');
  }
  const next = createGraphState(graph);
  next.nodes[node.id] = {
    ...node,
    status: node.status ?? 'indexed',
    confidence: clamp(node.confidence ?? 0.5)
  };
  return next;
}

export function validateGraphEdge(edge = {}) {
  const errors = [];
  if (!edge.from || !edge.to) errors.push('graph edge endpoints are required');
  if (!RELATIONS.includes(edge.relation)) errors.push('unsupported graph relation');
  if (!GRAPH_EDGE_STATUSES.includes(edge.status ?? 'candidate')) errors.push('unsupported graph edge status');
  if (EDGE_REQUIRE_PROVENANCE.has(edge.relation) && edge.status !== 'learner-observation' && !validProvenance(edge.provenance)) {
    errors.push('source provenance is required for this relation');
  }
  if (edge.status === 'verified' && !validProvenance(edge.provenance)) {
    errors.push('verified graph edges require provenance');
  }
  return { ok: errors.length === 0, errors };
}

export function addGraphEdge(graph, edge) {
  const validation = validateGraphEdge(edge);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  const next = createGraphState(graph);
  if (!next.nodes[edge.from] || !next.nodes[edge.to]) {
    throw new Error('graph endpoints must exist');
  }
  next.edges.push({
    ...edge,
    status: edge.status ?? 'candidate',
    confidence: clamp(edge.confidence ?? 0.5)
  });
  return next;
}

function prerequisiteRelationSet() {
  return new Set(['prerequisite_of', 'requires', 'strongly_requires', 'recommended_before', 'depends_on']);
}

export function prerequisiteGaps(graph, state, conceptId, threshold = 0.7) {
  const relationSet = prerequisiteRelationSet();
  const prerequisites = graph.edges.filter(edge => {
    if (!relationSet.has(edge.relation)) return false;
    if (edge.relation === 'prerequisite_of') return edge.from === conceptId;
    return edge.to === conceptId;
  });

  return prerequisites
    .map(edge => {
      const prerequisiteId = edge.relation === 'prerequisite_of' ? edge.to : edge.from;
      return {
        conceptId: prerequisiteId,
        relation: edge.relation,
        confidence: edge.confidence ?? 0.5,
        mastery: clamp(state?.skills?.[prerequisiteId]?.mastery ?? 0)
      };
    })
    .filter(entry => entry.mastery < threshold)
    .sort((a, b) => (b.confidence - a.confidence) || (a.mastery - b.mastery));
}

export function rankPrerequisiteHypotheses(graph, state, conceptId, threshold = 0.7) {
  return prerequisiteGaps(graph, state, conceptId, threshold).map((gap, index) => ({
    ...gap,
    routePriority: index + 1,
    hypothesis: 'candidate-prerequisite-gap'
  }));
}

export function diagnoseMisconception(graph, state, skillId, result = {}) {
  if (result.correct) return null;
  const candidates = graph.edges.filter(edge =>
    edge.from === skillId &&
    ['caused_by', 'causes_error_in', 'confused_with'].includes(edge.relation)
  );
  return candidates
    .map(edge => ({
      id: edge.to,
      relation: edge.relation,
      confidence: edge.confidence ?? 0.5,
      observed: Boolean(state?.misconceptions?.[edge.to]),
      status: edge.status ?? 'candidate',
      provenance: edge.provenance ?? null
    }))
    .sort((a, b) =>
      (Number(b.observed) - Number(a.observed)) ||
      (b.confidence - a.confidence)
    )[0] ?? null;
}

export function classifyLearningFailure({
  correct = false,
  confidence = 0.5,
  repeatedError = false,
  sourceIdCorrect = true,
  terminologyMismatch = false,
  contextMismatch = false,
  scholarlyDisagreement = false,
  knownMisconception = false
} = {}) {
  if (correct && confidence >= 0.5) return 'none';
  if (scholarlyDisagreement) return 'scholarly-disagreement';
  if (knownMisconception || (repeatedError && terminologyMismatch === false && contextMismatch === false)) return 'conceptual-misconception';
  if (terminologyMismatch) return 'terminology-confusion';
  if (!sourceIdCorrect) return 'source-attribution-error';
  if (contextMismatch) return 'contextual-misunderstanding';
  if (!correct && confidence < 0.4) return 'memory-failure';
  return 'unknown';
}

export function calibrate({ correct, confidence = 0.5, priorBias = 0 } = {}) {
  const c = clamp(confidence);
  const outcome = correct ? 1 : 0;
  const signed = outcome - c;
  const bias = Number.isFinite(Number(priorBias)) ? Number(priorBias) : 0;
  return {
    confidence: c,
    correctness: Boolean(correct),
    calibrationError: round(Math.abs(signed)),
    calibrationBias: round(clamp(bias, -1, 1) * 0.8 + signed * 0.2, 6),
    state: signed < -0.25 ? 'overconfident' : signed > 0.25 ? 'underconfident' : 'calibrated'
  };
}

export function updateCalibrationState(state = {}, attempt = {}) {
  const history = [...asArray(state.history), {
    correct: Boolean(attempt.correct),
    confidence: clamp(attempt.confidence ?? 0.5),
    timestamp: attempt.timestamp ?? new Date().toISOString(),
    contextKey: attempt.contextKey ?? 'general'
  }].slice(-200);

  const biasValues = history.map(entry => (entry.correct ? 1 : 0) - entry.confidence);
  const errors = history.map(entry => Math.abs((entry.correct ? 1 : 0) - entry.confidence));

  return {
    history,
    meanCalibrationBias: mean(biasValues) ?? 0,
    meanCalibrationError: mean(errors) ?? 0,
    overconfidenceRisk: clamp(Math.max(0, -(mean(biasValues) ?? 0))),
    underconfidenceRisk: clamp(Math.max(0, (mean(biasValues) ?? 0)))
  };
}

export function createLearnerProfile(input = {}) {
  const skills = {};
  for (const [skillId, skill] of Object.entries(input.skills ?? {})) {
    skills[skillId] = {
      mastery: clamp(skill?.mastery ?? 0),
      retrieval: clamp(skill?.retrieval ?? skill?.retrievability ?? 0),
      explanation: clamp(skill?.explanation ?? 0),
      application: clamp(skill?.application ?? 0),
      discrimination: clamp(skill?.discrimination ?? 0),
      transfer: clamp(skill?.transfer ?? 0),
      sourceNavigation: clamp(skill?.sourceNavigation ?? 0),
      retention: clamp(skill?.retention ?? 0)
    };
  }
  return {
    learnerId: input.learnerId ?? null,
    contextKey: input.contextKey ?? 'general',
    goals: unique(input.goals),
    language: {
      interface: input.language?.interface ?? null,
      learning: input.language?.learning ?? null,
      source: input.language?.source ?? null
    },
    skills,
    prerequisites: { ...(input.prerequisites ?? {}) },
    errorHistory: [...asArray(input.errorHistory)].slice(-100),
    reviewSchedule: { ...(input.reviewSchedule ?? {}) },
    confidence: { ...(input.confidence ?? {}) },
    modalityProfile: createMultimodalProfile(input.modalityProfile ?? {}),
    accessibility: { ...(input.accessibility ?? {}) },
    calibration: updateCalibrationState(input.calibration ?? {}, {}),
    privacy: {
      localFirst: true,
      telemetryOptIn: input.privacy?.telemetryOptIn === true,
      biometricInference: false
    }
  };
}

export function createMultimodalProfile(input = {}) {
  const modalities = ['text', 'audio', 'visual', 'speech', 'source_navigation'];
  return Object.fromEntries(modalities.map(modality => {
    const m = input?.[modality] ?? {};
    return [modality, {
      proficiency: clamp(m.proficiency ?? 0),
      confidence: clamp(m.confidence ?? 0.5),
      attempts: Math.max(0, Number(m.attempts) || 0),
      avgResponseTimeMs: Number.isFinite(m.avgResponseTimeMs) ? m.avgResponseTimeMs : null,
      optedIn: modality === 'speech' ? m.optedIn === true : true
    }];
  }));
}

export function updateLearnerSkill(profileInput = {}, event = {}) {
  const profile = createLearnerProfile(profileInput);
  const next = structuredClone(profile);
  for (const skillId of unique(event.skillIds)) {
    const prior = next.skills[skillId] ?? {
      mastery: 0, retrieval: 0, explanation: 0, application: 0,
      discrimination: 0, transfer: 0, sourceNavigation: 0, retention: 0
    };
    const correct = Boolean(event.correctness);
    const delta = correct ? 0.08 : -0.06;
    prior.mastery = clamp(prior.mastery + delta);
    if (event.mode === 'free-recall' || event.mode === 'cued-recall') prior.retrieval = clamp(prior.retrieval + (correct ? 0.06 : -0.04));
    if (event.mode === 'explain' || event.mode === 'teach-back') prior.explanation = clamp(prior.explanation + (correct ? 0.06 : -0.04));
    if (event.mode === 'transfer') prior.transfer = clamp(prior.transfer + (correct ? 0.08 : -0.05));
    if (event.sourceNavigation === true) prior.sourceNavigation = clamp(prior.sourceNavigation + (correct ? 0.05 : 0));
    next.skills[skillId] = prior;
  }
  next.errorHistory = [...next.errorHistory, {
    itemId: event.itemId ?? null,
    skillIds: unique(event.skillIds),
    correctness: event.correctness ?? null,
    failureType: event.failureType ?? null,
    timestamp: event.timestamp ?? new Date().toISOString()
  }].slice(-100);
  next.calibration = updateCalibrationState(next.calibration, event);
  return next;
}

export const METHOD_REGISTRY = Object.freeze({
  'retrieval-practice': {
    version: '1.0.0',
    targets: ['recall', 'retention'],
    prerequisites: [],
    stages: ['practice', 'consolidation'],
    feedbackRequired: true
  },
  'spaced-review': {
    version: '1.0.0',
    targets: ['retention', 'retrieval'],
    prerequisites: [],
    stages: ['consolidation'],
    feedbackRequired: true
  },
  interleaving: {
    version: '1.0.0',
    targets: ['discrimination', 'transfer'],
    prerequisites: ['basic-category-knowledge'],
    stages: ['practice', 'consolidation'],
    feedbackRequired: true
  },
  'worked-examples': {
    version: '1.0.0',
    targets: ['explanation', 'application'],
    prerequisites: [],
    stages: ['initial-learning', 'practice'],
    feedbackRequired: true
  },
  'self-explanation': {
    version: '1.0.0',
    targets: ['explanation'],
    prerequisites: ['basic-concept'],
    stages: ['practice', 'consolidation'],
    feedbackRequired: true
  },
  'concept-mapping': {
    version: '1.0.0',
    targets: ['structure', 'source-navigation'],
    prerequisites: ['basic-concept'],
    stages: ['practice', 'consolidation'],
    feedbackRequired: true
  },
  'refutation-correction': {
    version: '1.0.0',
    targets: ['discrimination', 'conceptual-understanding'],
    prerequisites: ['verified-evidence'],
    stages: ['practice', 'transfer'],
    feedbackRequired: true
  },
  'source-location-recall': {
    version: '1.0.0',
    targets: ['source-navigation', 'retrieval'],
    prerequisites: ['source-access'],
    stages: ['practice', 'consolidation'],
    feedbackRequired: true
  },
  'teach-back': {
    version: '1.0.0',
    targets: ['explanation', 'source-alignment'],
    prerequisites: ['verified-concept'],
    stages: ['practice', 'transfer'],
    feedbackRequired: true
  },
  transfer: {
    version: '1.0.0',
    targets: ['transfer', 'application'],
    prerequisites: ['mastery-evidence'],
    stages: ['transfer', 'assessment'],
    feedbackRequired: true
  },
  games: {
    version: '1.0.0',
    targets: ['retrieval', 'discrimination'],
    prerequisites: ['defined-learning-objective'],
    stages: ['practice'],
    feedbackRequired: true
  },
  'audio-practice': {
    version: '1.0.0',
    targets: ['audio-retrieval'],
    prerequisites: ['source-audio'],
    stages: ['practice', 'consolidation'],
    feedbackRequired: true
  },
  'visual-practice': {
    version: '1.0.0',
    targets: ['visual-retrieval', 'source-navigation'],
    prerequisites: ['verified-visual'],
    stages: ['practice', 'transfer'],
    feedbackRequired: true
  }
});

export function validateMethod(method = {}) {
  const errors = [];
  if (!method.id) errors.push('method id required');
  if (!method.version) errors.push('method version required');
  if (!asArray(method.targets).length) errors.push('method targets required');
  if (!asArray(method.stages).every(stage => METHOD_STAGES.includes(stage))) errors.push('unsupported method stage');
  return { ok: errors.length === 0, errors };
}

export function registerMethod(registry, method) {
  const validation = validateMethod(method);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  return { ...(registry ?? {}), [method.id]: { ...method } };
}

export function recordMethodOutcome(registry, outcome) {
  if (!outcome?.methodId) throw new Error('methodId required');
  const next = structuredClone(registry ?? {});
  const r = next[outcome.methodId] ?? {
    trials: 0,
    immediate: [],
    delayed: [],
    transfer: [],
    calibrationError: [],
    timeMs: [],
    errors: []
  };
  r.trials += 1;
  if (Number.isFinite(outcome.immediate)) r.immediate.push(outcome.immediate);
  if (Number.isFinite(outcome.delayed)) r.delayed.push(outcome.delayed);
  if (Number.isFinite(outcome.transfer)) r.transfer.push(outcome.transfer);
  if (Number.isFinite(outcome.calibrationError)) r.calibrationError.push(outcome.calibrationError);
  if (Number.isFinite(outcome.timeMs)) r.timeMs.push(outcome.timeMs);
  if (outcome.errorType) r.errors.push(outcome.errorType);
  next[outcome.methodId] = r;
  return next;
}

export function evaluateMethod(registry, methodId, minimumTrials = 10) {
  const r = registry?.[methodId];
  if (!r || !r.trials) return { methodId, trials: 0, status: 'insufficient-data' };
  return {
    methodId,
    trials: r.trials,
    immediateMean: mean(r.immediate),
    delayedMean: mean(r.delayed),
    transferMean: mean(r.transfer),
    calibrationErrorMean: mean(r.calibrationError),
    timeMsMean: mean(r.timeMs),
    status: r.trials >= minimumTrials ? 'eligible-for-comparison' : 'pilot',
    noUniversalBestClaim: true
  };
}

export function compareMethods(registry, methodIds = [], minimumTrials = 10) {
  return methodIds.map(id => evaluateMethod(registry, id, minimumTrials));
}

export function createAblationPlan({
  studyId,
  skillIds = [],
  population = null,
  arms = [],
  primaryOutcomes = ['delayed', 'transfer'],
  minimumTrials = 10
} = {}) {
  if (!studyId || !asArray(arms).length) throw new Error('studyId and arms are required');
  return {
    schemaVersion: '1.0.0',
    studyId,
    skillIds: unique(skillIds),
    population,
    arms: arms.map(arm => ({ ...arm })),
    primaryOutcomes: unique(primaryOutcomes),
    minimumTrials,
    privacyPreserving: true,
    noAutomaticPromotion: true
  };
}

export function evaluateAblation(plan, outcomes = []) {
  const grouped = {};
  for (const outcome of outcomes) {
    const key = outcome.armId;
    grouped[key] ??= [];
    grouped[key].push(outcome);
  }
  return {
    studyId: plan?.studyId ?? null,
    arms: (plan?.arms ?? []).map(arm => {
      const entries = grouped[arm.id] ?? [];
      return {
        armId: arm.id,
        trials: entries.length,
        immediateMean: mean(entries.map(e => e.immediate)),
        delayedMean: mean(entries.map(e => e.delayed)),
        transferMean: mean(entries.map(e => e.transfer)),
        confidenceErrorMean: mean(entries.map(e => e.confidenceError)),
        eligible: entries.length >= (plan.minimumTrials ?? 10)
      };
    }),
    noAutomaticPromotion: true
  };
}

export function buildEvidenceTrace({
  learningItemId,
  conceptId,
  claimId,
  evidenceId,
  sourceId,
  editionId = null,
  anchor,
  rightsStatus = null,
  reviewState = 'candidate'
} = {}) {
  return {
    schemaVersion: '1.0.0',
    learningItemId: learningItemId ?? null,
    conceptId: conceptId ?? null,
    claimId: claimId ?? null,
    evidenceId: evidenceId ?? null,
    sourceId: sourceId ?? null,
    editionId,
    anchor: anchor ?? null,
    rightsStatus,
    reviewState,
    traceable: Boolean(learningItemId && conceptId && evidenceId && sourceId && anchor),
    canonical: false
  };
}

export function validateEvidenceTrace(trace = {}) {
  const errors = [];
  for (const field of ['learningItemId', 'conceptId', 'evidenceId', 'sourceId', 'anchor']) {
    if (!trace[field]) errors.push(field + ' is required');
  }
  if (trace.reviewState === 'verified' && !['redistributable', 'licensed', 'public-domain', 'read-copy', 'read-only'].includes(trace.rightsStatus) && trace.rightsStatus !== null) {
    errors.push('verified learning trace has incompatible rights state');
  }
  return { ok: errors.length === 0, errors };
}

export function createLearningObject({
  itemId,
  sourceId,
  skillIds = [],
  prompt,
  answer,
  provenance,
  lifecycle = 'draft',
  machineGenerated = false,
  sourceVerified = false
} = {}) {
  const lifecycleStates = ['draft','machine-generated','source-verified','scholar-reviewed','published','deprecated'];
  const errors = [];
  if (!itemId) errors.push('itemId required');
  if (!sourceId) errors.push('sourceId required');
  if (!unique(skillIds).length) errors.push('skillIds required');
  if (!validProvenance(provenance)) errors.push('source provenance required');
  if (!lifecycleStates.includes(lifecycle)) errors.push('invalid lifecycle');
  if (lifecycle === 'published' && sourceVerified !== true) errors.push('published learning object requires source verification');
  if (machineGenerated && sourceVerified !== true) errors.push('machine-generated religious object requires verified source');
  return {
    object: {
      itemId: itemId ?? null,
      sourceId: sourceId ?? null,
      skillIds: unique(skillIds),
      prompt: prompt ?? null,
      answer: answer ?? null,
      provenance: provenance ?? null,
      lifecycle,
      machineGenerated,
      sourceVerified
    },
    validation: { ok: errors.length === 0, errors }
  };
}

export function invalidateLearningObject(item, reason = 'source-changed') {
  return {
    ...item,
    lifecycle: 'deprecated',
    invalidated: true,
    invalidationReason: reason,
    invalidatedAt: new Date().toISOString()
  };
}

export function buildProgressiveExplanation({
  shortAnswer,
  evidence = [],
  explanation = null,
  deepDive = null,
  originalSource = null
} = {}) {
  return {
    layers: {
      shortAnswer: shortAnswer ?? null,
      evidence: asArray(evidence),
      explanation,
      deepDive,
      originalSource
    },
    progressive: true
  };
}

export function buildTransferTask({
  sourceId,
  sourceAnchor,
  conceptIds = [],
  prompt,
  expectedEvidenceIds = [],
  targetContext,
  verifiedEvidence = true
} = {}) {
  const errors = [];
  if (!sourceId || !sourceAnchor) errors.push('source provenance required');
  if (!prompt) errors.push('transfer prompt required');
  if (!unique(conceptIds).length) errors.push('conceptIds required');
  if (!verifiedEvidence) errors.push('transfer generation requires verified evidence');
  return {
    ok: errors.length === 0,
    task: {
      mode: 'transfer',
      prompt: prompt ?? null,
      sourceId: sourceId ?? null,
      sourceAnchor: sourceAnchor ?? null,
      conceptIds: unique(conceptIds),
      expectedEvidenceIds: unique(expectedEvidenceIds),
      targetContext: targetContext ?? null,
      generatedFromVerifiedEvidence: verifiedEvidence === true
    },
    errors
  };
}

export function evaluateTransfer({
  correct = false,
  confidence = 0.5,
  novelContext = false,
  explanationQuality = 0,
  evidenceAlignment = 0
} = {}) {
  return {
    correct: Boolean(correct),
    confidence: clamp(confidence),
    novelContext: Boolean(novelContext),
    explanationQuality: clamp(explanationQuality),
    evidenceAlignment: clamp(evidenceAlignment),
    transferred: Boolean(correct && novelContext && explanationQuality >= 0.5 && evidenceAlignment >= 0.5)
  };
}

export function buildV3Decision({
  graph,
  state,
  skillId,
  result,
  methods = [],
  methodRegistry = {},
  source = null
} = {}) {
  const prereq = prerequisiteGaps(graph, state, skillId);
  const misconception = diagnoseMisconception(graph, state, skillId, result);
  const failureType = classifyLearningFailure({
    correct: result?.correct,
    confidence: result?.confidence,
    repeatedError: Boolean(result?.repeatedError),
    sourceIdCorrect: result?.sourceIdCorrect !== false,
    terminologyMismatch: Boolean(result?.terminologyMismatch),
    contextMismatch: Boolean(result?.contextMismatch),
    scholarlyDisagreement: Boolean(result?.scholarlyDisagreement),
    knownMisconception: Boolean(result?.knownMisconception)
  });
  const calibration = calibrate({
    correct: result?.correct,
    confidence: result?.confidence,
    priorBias: state?.calibrationBias
  });
  const comparisons = compareMethods(methodRegistry, methods);

  const reasons = [];
  if (prereq.length) reasons.push('prerequisite-gap');
  if (misconception) reasons.push('misconception-candidate');
  if (calibration.state !== 'calibrated') reasons.push('confidence-mismatch');
  if (!result?.correct) reasons.push('recent-error');

  return {
    version: V3_VERSION,
    diagnosis: {
      prerequisiteGap: prereq.length > 0,
      prerequisiteGaps: prereq,
      misconception,
      failureType,
      calibration
    },
    methodEvidence: comparisons,
    recommendation: {
      route: prereq.length ? 'prerequisite-remediation' :
        misconception ? 'misconception-remediation' :
        calibration.state !== 'calibrated' ? 'calibration-practice' :
        'continue-practice',
      reasons: unique(reasons),
      supportingSource: source,
      inspectable: true
    },
    transferRequired: !result?.correct || calibration.state !== 'calibrated',
    acquisitionIndependent: true,
    sourceGrounded: Boolean(source)
  };
}

export function buildAiTaskConstraints({
  sourceIds = [],
  evidenceIds = [],
  allowCanonicalWrite = false,
  scholarlyReviewRequired = true
} = {}) {
  return {
    sourceIds: unique(sourceIds),
    evidenceIds: unique(evidenceIds),
    mustCiteEvidence: true,
    allowCanonicalWrite: allowCanonicalWrite === true && false,
    scholarlyReviewRequired: scholarlyReviewRequired !== false,
    generatedOutputIsCanonical: false,
    unsupportedFactsRejected: true
  };
}

export function getV3Capabilities() {
  return {
    engine: 'Rechercher Learning Intelligence Engine v3',
    version: V3_VERSION,
    graphs: [...['knowledge','evidence','prerequisite','misconception','learner']],
    graphRelations: [...RELATIONS],
    learnerDimensions: ['recognition','recall','explanation','application','discrimination','transfer','source-navigation','confidence-calibration','retention'],
    multimodalProfile: ['text','audio','visual','speech','source_navigation'],
    failureTypes: [...FAILURE_TYPES],
    methodRegistry: Object.keys(METHOD_REGISTRY),
    evaluation: ['immediate','delayed','transfer','calibration','method-ablation'],
    sourceGrounded: true,
    privacyByDesign: true,
    acquisitionIndependent: true
  };
}

export function canLearningBlockAcquisition() {
  return false;
}
