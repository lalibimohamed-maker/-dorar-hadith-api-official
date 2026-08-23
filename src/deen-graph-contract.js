export const NODE_TYPES = Object.freeze(["quran_verse","hadith","hadith_variant","tafsir","asbab_al_nuzul","sirah_event","companion_statement","scholar_statement","scholar","narrator","rijal_entry","fiqh_ruling","aqeedah_statement","fatwa","book","chapter","concept","source"]);

export const EDGE_TYPES = Object.freeze(["explains","contextualizes","cause_of_revelation_for","related_to","supports","reports","variant_of","narrated_by","has_narrator","evaluated_by","commented_on","cites","derived_from","applies_to","contradicts","qualifies","same_event_as","same_concept_as","part_of","published_in","source_of"]);

const TRUSTED_STATES = new Set(["source_verified","edition_verified","scholar_reviewed"]);

export const isNodeType = (value) => NODE_TYPES.includes(String(value || ""));
export const isEdgeType = (value) => EDGE_TYPES.includes(String(value || ""));
export const isTrustedEvidence = (value = {}) => TRUSTED_STATES.has(String(value.verificationState || ""));

export function validateNode(node = {}) {
  const errors = [];
  if (!node.id) errors.push("missing:id");
  if (!isNodeType(node.type)) errors.push(`unsupported-node-type:${node.type}`);
  if (!node.provenance || typeof node.provenance !== "object") errors.push("missing:provenance");
  return { valid: errors.length === 0, errors };
}

export function validateEdge(edge = {}) {
  const errors = [];
  if (!edge.id) errors.push("missing:id");
  if (!edge.from) errors.push("missing:from");
  if (!edge.to) errors.push("missing:to");
  if (!isEdgeType(edge.type)) errors.push(`unsupported-edge-type:${edge.type}`);
  if (!edge.provenance || typeof edge.provenance !== "object") errors.push("missing:provenance");
  return { valid: errors.length === 0, errors };
}

export function validateGraph({ nodes = [], edges = [] } = {}) {
  const errors = [];
  const ids = new Set(nodes.map((node) => node.id).filter(Boolean));
  for (const node of nodes) {
    const result = validateNode(node);
    errors.push(...result.errors.map((error) => `node:${node.id ?? "?"}:${error}`));
  }
  for (const edge of edges) {
    const result = validateEdge(edge);
    errors.push(...result.errors.map((error) => `edge:${edge.id ?? "?"}:${error}`));
    if (edge.from && !ids.has(edge.from)) errors.push(`edge:${edge.id}:missing-from-node:${edge.from}`);
    if (edge.to && !ids.has(edge.to)) errors.push(`edge:${edge.id}:missing-to-node:${edge.to}`);
  }
  return { valid: errors.length === 0, errors, nodeCount: nodes.length, edgeCount: edges.length };
}

export function assertSourceBackedEvidence(evidence = {}) {
  if (evidence.generated === true) throw new TypeError("Generated content cannot be promoted to source-backed evidence");
  if (!evidence.sourceId || !evidence.citation) throw new TypeError("Evidence requires sourceId and citation");
  return true;
}
