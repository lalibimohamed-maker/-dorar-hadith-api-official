const REQUIRED_VARIANT_FIELDS = ['id', 'hadithId', 'text', 'sourceId', 'citation'];
const ALLOWED_RELATIONS = new Set([
  'variant_of',
  'supports',
  'has_same_chain',
  'has_different_chain',
  'cited_in'
]);

export function validateHadithVariant(variant = {}) {
  const errors = [];
  for (const field of REQUIRED_VARIANT_FIELDS) {
    if (variant[field] == null || variant[field] === '') errors.push(`variant:missing:${field}`);
  }
  if (variant.generated === true) errors.push('variant:generated-content-not-allowed');
  return { valid: errors.length === 0, errors };
}

export function registerHadithVariant(registry, variant) {
  const result = validateHadithVariant(variant);
  if (!result.valid) throw new TypeError(`Invalid hadith variant: ${result.errors.join(',')}`);
  if (registry.has(variant.id)) throw new TypeError(`Duplicate hadith variant: ${variant.id}`);
  registry.set(variant.id, structuredClone(variant));
  return variant.id;
}

export function createHadithRelation(relation = {}) {
  if (!relation.id || !relation.from || !relation.to) throw new TypeError('Invalid relation:missing-identity');
  if (!ALLOWED_RELATIONS.has(relation.type)) throw new TypeError(`Invalid relation:type:${relation.type}`);
  if (relation.generated === true) throw new TypeError('Invalid relation:generated-content-not-allowed');
  if (!relation.sourceId || !relation.citation) throw new TypeError('Invalid relation:missing-provenance');
  return structuredClone(relation);
}

export function buildHadithVariantNetwork(variants = [], relations = []) {
  const variantIds = new Set();
  const nodes = [];
  for (const variant of variants) {
    if (variantIds.has(variant.id)) throw new TypeError(`Duplicate hadith variant: ${variant.id}`);
    const result = validateHadithVariant(variant);
    if (!result.valid) throw new TypeError(`Invalid hadith variant: ${result.errors.join(',')}`);
    variantIds.add(variant.id);
    nodes.push(structuredClone(variant));
  }
  const edges = relations.map(createHadithRelation);
  for (const edge of edges) {
    if (!variantIds.has(edge.from) || !variantIds.has(edge.to)) {
      throw new TypeError(`Invalid relation:unknown-node:${edge.id}`);
    }
  }
  return { nodes, edges };
}
