const REQUIRED_COMMENTARY_FIELDS = ['id', 'hadithId', 'text', 'scholar', 'sourceId', 'citation'];
const REQUIRED_GLOSS_FIELDS = ['id', 'commentaryId', 'term', 'meaning', 'sourceId', 'citation'];
const ALLOWED_COMMENTARY_RELATIONS = new Set(['explains', 'defines', 'derives_from', 'supports', 'cited_in']);

function requireFields(value, fields, prefix) {
  const errors = [];
  for (const field of fields) {
    if (value[field] == null || value[field] === '') errors.push(`${prefix}:missing:${field}`);
  }
  return errors;
}

export function validateHadithCommentary(commentary = {}) {
  const errors = requireFields(commentary, REQUIRED_COMMENTARY_FIELDS, 'commentary');
  if (commentary.generated === true) errors.push('commentary:generated-content-not-allowed');
  return { valid: errors.length === 0, errors };
}

export function validateVocabularyGloss(gloss = {}) {
  const errors = requireFields(gloss, REQUIRED_GLOSS_FIELDS, 'gloss');
  if (gloss.generated === true) errors.push('gloss:generated-content-not-allowed');
  return { valid: errors.length === 0, errors };
}

export function registerCommentary(registry, commentary) {
  const result = validateHadithCommentary(commentary);
  if (!result.valid) throw new TypeError(`Invalid commentary: ${result.errors.join(',')}`);
  if (registry.has(commentary.id)) throw new TypeError(`Duplicate commentary: ${commentary.id}`);
  registry.set(commentary.id, structuredClone(commentary));
  return commentary.id;
}

export function registerVocabularyGloss(registry, gloss) {
  const result = validateVocabularyGloss(gloss);
  if (!result.valid) throw new TypeError(`Invalid vocabulary gloss: ${result.errors.join(',')}`);
  if (registry.has(gloss.id)) throw new TypeError(`Duplicate vocabulary gloss: ${gloss.id}`);
  registry.set(gloss.id, structuredClone(gloss));
  return gloss.id;
}

export function createCommentaryRelation(relation = {}) {
  if (!relation.id || !relation.from || !relation.to) throw new TypeError('Invalid commentary relation:missing-identity');
  if (!ALLOWED_COMMENTARY_RELATIONS.has(relation.type)) throw new TypeError(`Invalid commentary relation:type:${relation.type}`);
  if (!relation.sourceId || !relation.citation) throw new TypeError('Invalid commentary relation:missing-provenance');
  if (relation.generated === true) throw new TypeError('Invalid commentary relation:generated-content-not-allowed');
  return structuredClone(relation);
}

export function buildCommentaryNetwork(commentaries = [], glosses = [], relations = []) {
  const nodes = new Map();
  for (const commentary of commentaries) {
    const result = validateHadithCommentary(commentary);
    if (!result.valid) throw new TypeError(`Invalid commentary: ${result.errors.join(',')}`);
    if (nodes.has(commentary.id)) throw new TypeError(`Duplicate commentary: ${commentary.id}`);
    nodes.set(commentary.id, { kind: 'commentary', ...structuredClone(commentary) });
  }
  for (const gloss of glosses) {
    const result = validateVocabularyGloss(gloss);
    if (!result.valid) throw new TypeError(`Invalid vocabulary gloss: ${result.errors.join(',')}`);
    if (nodes.has(gloss.id)) throw new TypeError(`Duplicate commentary node: ${gloss.id}`);
    if (!nodes.has(gloss.commentaryId)) throw new TypeError(`Unknown commentary: ${gloss.commentaryId}`);
    nodes.set(gloss.id, { kind: 'vocabulary', ...structuredClone(gloss) });
  }
  const edges = relations.map(createCommentaryRelation);
  for (const edge of edges) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) throw new TypeError(`Unknown commentary relation node: ${edge.id}`);
  }
  return { nodes: [...nodes.values()], edges };
}
