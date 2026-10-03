export const RESOURCE_IDENTITY_CHAIN_VERSION = '1.0.0';
export const RESOURCE_IDENTITY_LAYERS = Object.freeze([
  'source_id','work_id','edition_id','manifestation_id','manuscript_id','page_id','canvas_id','passage_id','evidence_id','claim_id'
]);

export function createResourceIdentity(input = {}) {
  for (const key of RESOURCE_IDENTITY_LAYERS.slice(0, 1)) if (!input[key]) throw new TypeError(`${key} is required`);
  return Object.freeze({
    ...Object.fromEntries(RESOURCE_IDENTITY_LAYERS.map(key => [key, input[key] ?? null])),
    language: input.language ?? null,
    retrieval_date: input.retrieval_date ?? null,
    content_hash: input.content_hash ?? null,
    license: input.license ?? null,
    rights_status: input.rights_status ?? 'UNKNOWN',
    provenance: input.provenance ?? null,
  });
}

export function validateResourceIdentity(identity) {
  const errors = [];
  if (!identity?.source_id) errors.push('source_id');
  if (!identity?.work_id) errors.push('work_id');
  if (!identity?.provenance) errors.push('provenance');
  if (!identity?.content_hash) errors.push('content_hash');
  return { valid: errors.length === 0, errors };
}

export function createResourceIdentityChain(input = {}) {
  const identity = createResourceIdentity(input);
  const validation = validateResourceIdentity(identity);
  return { version: RESOURCE_IDENTITY_CHAIN_VERSION, identity, validation };
}
