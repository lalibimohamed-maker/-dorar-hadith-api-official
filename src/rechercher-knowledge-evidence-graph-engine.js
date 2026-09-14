export const RELATIONS = Object.freeze(['SUPPORTED_BY','CONTRADICTED_BY','EXPLAINS','COMMENTS_ON','QUOTES','ATTRIBUTED_TO','TRANSMITTED_BY','TRANSLATED_AS','DERIVED_FROM']);
export const REVIEW_STATES = Object.freeze(['UNREVIEWED','CANDIDATE','HUMAN_REVIEWED','SCHOLAR_REVIEWED']);

export function createKnowledgeEvidenceGraphEngine() { return { nodes: new Map(), edges: new Map() }; }

function node(engine, id, type, data = {}) { if (!id || !type) throw new TypeError('node id and type are required'); if (engine.nodes.has(id)) throw new Error(`Duplicate node: ${id}`); engine.nodes.set(id, { id, type, data: structuredClone(data) }); return id; }
export function addSourceNode(engine, { id, sourceId, rightsStatus = 'UNKNOWN', provenance = null } = {}) { return node(engine, id, 'SOURCE', { sourceId, rightsStatus, provenance }); }
export function addClaimNode(engine, { id, text, evidenceState = 'AI_GENERATED' } = {}) { return node(engine, id, 'CLAIM', { text, evidenceState }); }
export function addEntityNode(engine, { id, type, data = {} } = {}) { return node(engine, id, type, data); }

export function addEvidenceRelation(engine, { id, from, to, type, status = 'CANDIDATE', evidence = [], confidence = 0, provenance = null, reviewState = 'UNREVIEWED' } = {}) {
  if (!id || !from || !to || !RELATIONS.includes(type)) throw new TypeError('invalid evidence relation');
  if (!engine.nodes.has(from) || !engine.nodes.has(to)) throw new Error('relation endpoint is unknown');
  if (confidence < 0 || confidence > 1) throw new RangeError('confidence must be between 0 and 1');
  if (!REVIEW_STATES.includes(reviewState)) throw new TypeError('invalid reviewState');
  engine.edges.set(id, { id, from, to, type, status, evidence: structuredClone(evidence), confidence, provenance: structuredClone(provenance), reviewState });
  return id;
}

export function reviewEvidenceRelation(engine, edgeId, { reviewerRole, decision, notes = '' } = {}) {
  const edge = engine.edges.get(edgeId); if (!edge) throw new Error(`Unknown edge: ${edgeId}`);
  if (!['TEACHER','SCHOLAR'].includes(reviewerRole)) throw new Error('Human reviewer role required');
  edge.reviewState = reviewerRole === 'SCHOLAR' ? 'SCHOLAR_REVIEWED' : 'HUMAN_REVIEWED'; edge.status = decision; edge.notes = notes;
  return structuredClone(edge);
}

export function publishableClaim(engine, claimId) {
  const claim = engine.nodes.get(claimId); if (!claim || claim.type !== 'CLAIM') throw new Error(`Unknown claim: ${claimId}`);
  if (claim.data.evidenceState === 'AI_GENERATED') return false;
  const edges = [...engine.edges.values()].filter(e => e.from === claimId || e.to === claimId);
  if (!edges.length || !edges.every(e => e.reviewState === 'SCHOLAR_REVIEWED')) return false;
  for (const e of edges) { const target = engine.nodes.get(e.to); if (target?.type === 'SOURCE' && target.data.rightsStatus !== 'ALLOWED') return false; }
  return true;
}
