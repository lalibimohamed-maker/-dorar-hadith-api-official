export const PRESERVATION_ENGINE_VERSION = '1.0.0';
export const PRESERVATION_EVENT_TYPES = Object.freeze(['ACQUISITION','VALIDATION','CHECKSUM','PRESERVATION','NORMALIZATION','OCR','DERIVATION','ACCESS']);

export function createPreservationEvent(input = {}) {
  if (!input.event_id) throw new TypeError('event_id is required');
  if (!input.object_id) throw new TypeError('object_id is required');
  if (!PRESERVATION_EVENT_TYPES.includes(input.event_type)) throw new TypeError('unsupported event_type');
  return Object.freeze({
    event_id: input.event_id,
    event_type: input.event_type,
    object_id: input.object_id,
    timestamp: input.timestamp ?? new Date().toISOString(),
    agent_id: input.agent_id ?? null,
    outcome: input.outcome ?? 'UNKNOWN',
    input_hash: input.input_hash ?? null,
    output_hash: input.output_hash ?? null,
    software: input.software ?? null,
    rights_evidence: input.rights_evidence ?? null,
    provenance: input.provenance ?? null,
    immutable_source: input.immutable_source !== false,
  });
}

export function validatePreservationChain(events = []) {
  const errors = [];
  for (const event of events) {
    if (!event.object_id) errors.push('missing_object_id');
    if (!event.provenance) errors.push(`missing_provenance:${event.event_id}`);
    if (event.event_type === 'CHECKSUM' && !event.output_hash) errors.push(`missing_checksum:${event.event_id}`);
  }
  return { valid: errors.length === 0, errors };
}
