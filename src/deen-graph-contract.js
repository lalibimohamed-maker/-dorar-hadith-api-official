export const NODE_TYPES = Object.freeze(["quran_verse","hadith","hadith_variant","tafsir","asbab_al_nuzul","sirah_event","companion_statement","scholar_statement","scholar","narrator","rijal_entry","hadith_criticism","explanation","benefit","fiqh_ruling","aqeedah_statement","fatwa","book","chapter","concept","source"]);

export const EDGE_TYPES = Object.freeze(["explains","contextualizes","cause_of_revelation_for","related_to","supports","reports","variant_of","narrated_by","has_narrator","evaluated_by","commented_on","cites","derived_from","applies_to","contradicts","qualifies","same_event_as","same_concept_as","part_of","published_in","source_of"]);

export const EVIDENCE_LAYERS = Object.freeze([
  "primary_text",
  "scholarly_interpretation",
  "metadata",
  "relation",
  "generated_assistance"
]);

export const VERIFICATION_STATES = Object.freeze([
  "ingested",
  "pending_review",
  "pending_verification",
  "source_verified",
  "edition_verified",
  "scholar_reviewed"
]);

const TRUSTED_STATES = new Set(["source_verified","edition_verified","scholar_reviewed"]);

export const isNodeType = (value) => NODE_TYPES.includes(String(value || ""));
export const isEdgeType = (value) => EDGE_TYPES.includes(String(value || ""));
export const isVerificationState = (value) => VERIFICATION_STATES.includes(String(value || ""));
export const isTrustedVerificationState = (value) => TRUSTED_STATES.has(String(value || ""));
export const isTrustedEvidence = (value = {}) =>
  isTrustedVerificationState(value.verificationState) && value.generated !== true;

export function validateProvenance(provenance = {}) {
  const errors = [];
  if (!provenance || typeof provenance !== "object") return { valid: false, errors: ["missing:provenance"] };
  if (!provenance.sourceId) errors.push("missing:sourceId");
  if (!provenance.citation) errors.push("missing:citation");
  if (provenance.verificationState && !isVerificationState(provenance.verificationState)) {
    errors.push(`unsupported-verification-state:${provenance.verificationState}`);
  }
  if ("rights" in provenance && provenance.rights === null) errors.push("invalid:rights");
  return { valid: errors.length === 0, errors };
}

export function validateNode(node = {}) {
  const errors = [];
  if (!node.id) errors.push("missing:id");
  if (!isNodeType(node.type)) errors.push(`unsupported-node-type:${node.type}`);
  const provenance = validateProvenance(node.provenance);
  errors.push(...provenance.errors);
  return { valid: errors.length === 0, errors };
}

export function validateEdge(edge = {}) {
  const errors = [];
  if (!edge.id) errors.push("missing:id");
  if (!edge.from) errors.push("missing:from");
  if (!edge.to) errors.push("missing:to");
  if (!isEdgeType(edge.type)) errors.push(`unsupported-edge-type:${edge.type}`);
  const provenance = validateProvenance(edge.provenance);
  errors.push(...provenance.errors);
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

export function validateTrustedPath({ nodes = [], edges = [] } = {}) {
  const result = validateGraph({ nodes, edges });
  const errors = [...result.errors];
  for (const node of nodes) {
    if (!isTrustedEvidence(node.provenance)) {
      errors.push(`node:${node.id}:not-trusted`);
    }
    if (!Object.prototype.hasOwnProperty.call(node.provenance || {}, "rights")) {
      errors.push(`node:${node.id}:missing-rights-metadata`);
    }
  }
  for (const edge of edges) {
    if (!isTrustedEvidence(edge.provenance)) {
      errors.push(`edge:${edge.id}:not-trusted`);
    }
    if (!Object.prototype.hasOwnProperty.call(edge.provenance || {}, "rights")) {
      errors.push(`edge:${edge.id}:missing-rights-metadata`);
    }
  }
  return {
    valid: errors.length === 0,
    trusted: errors.length === 0,
    errors,
    nodeCount: nodes.length,
    edgeCount: edges.length
  };
}

export function assertSourceBackedEvidence(evidence = {}) {
  if (evidence.generated === true || evidence.evidenceLayer === "generated_assistance") {
    throw new TypeError("Generated content cannot be promoted to source-backed evidence");
  }
  if (!evidence.sourceId || !evidence.citation) throw new TypeError("Evidence requires sourceId and citation");
  if (evidence.verificationState && !isVerificationState(evidence.verificationState)) {
    throw new TypeError(`Unsupported verification state: ${evidence.verificationState}`);
  }
  return true;
}
