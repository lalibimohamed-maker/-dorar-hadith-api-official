export function createCitationReproducibilityEngine() { return { traces: new Map(), citations: new Map() }; }

function required(v, n) { if (!v) throw new TypeError(`${n} is required`); }

export function startTrace(engine, { traceId, question, actor = 'SYSTEM', startedAt = null } = {}) {
  required(traceId, 'traceId'); required(question, 'question');
  if (engine.traces.has(traceId)) throw new Error(`Duplicate trace: ${traceId}`);
  engine.traces.set(traceId, { traceId, question, actor, startedAt, sources: [], transformations: [], outputs: [], status: 'OPEN' });
  return traceId;
}

export function recordSource(engine, traceId, { sourceId, contentHash, locator = null, retrievedAt = null } = {}) {
  const trace = engine.traces.get(traceId); if (!trace) throw new Error(`Unknown trace: ${traceId}`); required(sourceId, 'sourceId'); required(contentHash, 'contentHash');
  trace.sources.push({ sourceId, contentHash, locator, retrievedAt }); return trace.sources.at(-1);
}

export function recordTransformation(engine, traceId, { stepId, operation, inputHashes = [], outputHash = null } = {}) {
  const trace = engine.traces.get(traceId); if (!trace) throw new Error(`Unknown trace: ${traceId}`); required(stepId, 'stepId'); required(operation, 'operation');
  trace.transformations.push({ stepId, operation, inputHashes: [...inputHashes], outputHash }); return trace.transformations.at(-1);
}

export function addCitation(engine, { citationId, traceId, sourceId, locator, claimId = null } = {}) {
  required(citationId, 'citationId'); required(traceId, 'traceId'); required(sourceId, 'sourceId'); required(locator, 'locator');
  if (!engine.traces.has(traceId)) throw new Error(`Unknown trace: ${traceId}`);
  const citation = { citationId, traceId, sourceId, locator, claimId }; engine.citations.set(citationId, citation); return citationId;
}

export function closeTrace(engine, traceId, { outputHashes = [], status = 'COMPLETED', completedAt = null } = {}) {
  const trace = engine.traces.get(traceId); if (!trace) throw new Error(`Unknown trace: ${traceId}`);
  trace.outputs = [...outputHashes]; trace.status = status; trace.completedAt = completedAt; return structuredClone(trace);
}
