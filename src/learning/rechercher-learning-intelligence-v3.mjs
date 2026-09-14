export const V3_VERSION = '3.0.0';

export const GRAPH_TYPES = [
  'knowledge',
  'evidence',
  'prerequisite',
  'misconception',
  'learner',
];

export const RELATIONS = [
  'supports',
  'contradicts',
  'requires',
  'strongly_requires',
  'recommended_before',
  'parallel_to',
  'advanced_form_of',
  'depends_on',
  'caused_by',
  'confused_with',
  'corrected_by',
  'retested_by',
];

const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number(n) || 0));

export function createGraphState(input = {}) {
  return {
    version: V3_VERSION,
    nodes: { ...(input.nodes || {}) },
    edges: Array.isArray(input.edges) ? [...input.edges] : [],
    reviewQueue: Array.isArray(input.reviewQueue) ? [...input.reviewQueue] : [],
  };
}

export function addGraphNode(graph, node) {
  if (!node?.id || !node?.type || !GRAPH_TYPES.includes(node.type)) throw new Error('invalid graph node');
  const next = createGraphState(graph);
  next.nodes[node.id] = { ...node };
  return next;
}

export function addGraphEdge(graph, edge) {
  if (!edge?.from || !edge?.to || !RELATIONS.includes(edge.relation)) throw new Error('invalid graph edge');
  const next = createGraphState(graph);
  if (!next.nodes[edge.from] || !next.nodes[edge.to]) throw new Error('graph endpoints must exist');
  next.edges.push({ ...edge, confidence: clamp(edge.confidence ?? 0.5) });
  return next;
}

export function prerequisiteGaps(graph, state, conceptId, threshold = 0.7) {
  const prerequisites = graph.edges.filter(e => e.to === conceptId && ['requires', 'strongly_requires', 'recommended_before', 'depends_on'].includes(e.relation));
  return prerequisites.filter(e => (state?.skills?.[e.from]?.mastery ?? 0) < threshold).map(e => ({ conceptId: e.from, relation: e.relation, mastery: state?.skills?.[e.from]?.mastery ?? 0 }));
}

export function diagnoseMisconception(graph, state, skillId, result = {}) {
  if (result.correct) return null;
  const candidates = graph.edges.filter(e => e.from === skillId && ['caused_by', 'confused_with'].includes(e.relation));
  return candidates
    .map(e => ({ id: e.to, confidence: e.confidence ?? 0.5, observed: Boolean(state?.misconceptions?.[e.to]) }))
    .sort((a, b) => (Number(b.observed) - Number(a.observed)) || (b.confidence - a.confidence))[0] ?? null;
}

export function calibrate({ correct, confidence = 0.5, priorBias = 0 } = {}) {
  const c = clamp(confidence);
  const outcome = correct ? 1 : 0;
  const bias = clamp(priorBias, -1, 1);
  const signed = outcome - c;
  return {
    confidence: c,
    calibrationError: Math.abs(signed),
    calibrationBias: Number((0.8 * bias + 0.2 * signed).toFixed(6)),
    state: signed < -0.25 ? 'overconfident' : signed > 0.25 ? 'underconfident' : 'calibrated',
  };
}

export function createMultimodalProfile(input = {}) {
  const modalities = ['text', 'audio', 'visual', 'speech', 'source_navigation'];
  return Object.fromEntries(modalities.map(m => [m, {
    proficiency: clamp(input[m]?.proficiency ?? 0),
    confidence: clamp(input[m]?.confidence ?? 0.5),
    attempts: Number(input[m]?.attempts || 0),
  }]));
}

export function recordMethodOutcome(registry, outcome) {
  if (!outcome?.methodId) throw new Error('methodId required');
  const next = { ...(registry || {}) };
  const r = next[outcome.methodId] || { trials: 0, immediate: [], delayed: [], transfer: [], timeMs: [] };
  r.trials += 1;
  if (Number.isFinite(outcome.immediate)) r.immediate = [...r.immediate, outcome.immediate];
  if (Number.isFinite(outcome.delayed)) r.delayed = [...r.delayed, outcome.delayed];
  if (Number.isFinite(outcome.transfer)) r.transfer = [...r.transfer, outcome.transfer];
  if (Number.isFinite(outcome.timeMs)) r.timeMs = [...r.timeMs, outcome.timeMs];
  next[outcome.methodId] = r;
  return next;
}

const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

export function evaluateMethod(registry, methodId) {
  const r = registry?.[methodId];
  if (!r || !r.trials) return { methodId, trials: 0, status: 'insufficient-data' };
  return {
    methodId,
    trials: r.trials,
    immediateMean: mean(r.immediate),
    delayedMean: mean(r.delayed),
    transferMean: mean(r.transfer),
    timeMsMean: mean(r.timeMs),
    status: r.trials >= 10 ? 'eligible-for-comparison' : 'pilot',
  };
}

export function compareMethods(registry, methodIds = []) {
  return methodIds.map(id => evaluateMethod(registry, id)).sort((a, b) => (b.transferMean ?? -1) - (a.transferMean ?? -1));
}

export function buildV3Decision({ graph, state, skillId, result, methods = [], methodRegistry = {} } = {}) {
  const prereq = prerequisiteGaps(graph, state, skillId);
  const misconception = diagnoseMisconception(graph, state, skillId, result);
  const calibration = calibrate({ correct: result?.correct, confidence: result?.confidence, priorBias: state?.calibrationBias });
  const comparisons = compareMethods(methodRegistry, methods);
  return {
    diagnosis: {
      prerequisiteGap: prereq.length > 0,
      prerequisiteGaps: prereq,
      misconception,
      calibration,
    },
    methodEvidence: comparisons,
    transferRequired: !result?.correct || calibration.state !== 'calibrated',
    acquisitionIndependent: true,
  };
}

export function canLearningBlockAcquisition() { return false; }
