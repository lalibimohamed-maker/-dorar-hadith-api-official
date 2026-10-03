export function createTransferGraphEngine() {
  return { concepts: new Map(), edges: new Map() };
}

export function registerTransferConcept(engine, { conceptId, domain, title, sourceIds = [] } = {}) {
  if (!conceptId || !domain || !title) throw new TypeError('transfer concept requires identity, domain and title');
  const concept = { conceptId, domain, title, sourceIds: [...sourceIds] };
  engine.concepts.set(conceptId, concept);
  return concept;
}

export function addTransferEdge(engine, { edgeId, fromConceptId, toConceptId, relation = 'TRANSFER', evidenceSourceIds = [], confidence = 0 } = {}) {
  if (!edgeId || !engine.concepts.has(fromConceptId) || !engine.concepts.has(toConceptId)) throw new Error('transfer edge requires registered concepts');
  if (!(confidence >= 0 && confidence <= 1)) throw new RangeError('confidence must be between 0 and 1');
  const edge = { edgeId, fromConceptId, toConceptId, relation, evidenceSourceIds: [...evidenceSourceIds], confidence };
  engine.edges.set(edgeId, edge);
  return edge;
}

export function suggestTransfers(engine, conceptId, minConfidence = 0.5) {
  if (!engine.concepts.has(conceptId)) throw new Error(`Unknown concept: ${conceptId}`);
  return [...engine.edges.values()]
    .filter(edge => edge.fromConceptId === conceptId && edge.confidence >= minConfidence)
    .map(edge => engine.concepts.get(edge.toConceptId));
}
