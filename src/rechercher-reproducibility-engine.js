export function createReproducibilityEngine() {
  return { traces: new Map() };
}

export function recordResearchTrace(engine, trace) {
  for (const key of ['traceId', 'caseId', 'recordedAt', 'engineVersion', 'query']) if (!trace?.[key]) throw new TypeError(`Trace requires ${key}`);
  if (!Array.isArray(trace.sourceIds) || !Array.isArray(trace.transformations)) throw new TypeError('Trace requires sourceIds and transformations arrays');
  const stored = structuredClone({ ...trace, status: trace.status || 'REPRODUCIBLE_CANDIDATE' });
  engine.traces.set(trace.traceId, stored);
  return trace.traceId;
}

export function verifyResearchTrace(engine, traceId) {
  const trace = engine.traces.get(traceId);
  if (!trace) throw new Error(`Unknown trace: ${traceId}`);
  const complete = trace.sourceIds.length > 0 && trace.transformations.every((t) => t?.name && t?.version && t?.inputHash && t?.outputHash);
  return { traceId, complete, reproducible: complete && trace.status !== 'NON_REPRODUCIBLE' };
}
