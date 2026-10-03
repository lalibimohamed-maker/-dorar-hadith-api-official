import test from 'node:test';
import assert from 'node:assert/strict';
import { createResourceIdentityChain } from '../src/rechercher-resource-identity-chain-engine.js';
import { createPreservationEvent, validatePreservationChain } from '../src/rechercher-preservation-event-engine.js';

test('resource identity reaches claim level without losing provenance', () => {
  const result = createResourceIdentityChain({
    source_id: 'source-1', work_id: 'work-1', edition_id: 'edition-1', manifestation_id: 'manifestation-1',
    manuscript_id: 'manuscript-1', page_id: 'page-1', canvas_id: 'canvas-1', passage_id: 'passage-1',
    evidence_id: 'evidence-1', claim_id: 'claim-1', language: 'ar', retrieval_date: '2026-09-15',
    content_hash: 'sha256:test', rights_status: 'ALLOWED', provenance: { source: 'test' },
  });
  assert.equal(result.validation.valid, true);
  assert.equal(result.identity.claim_id, 'claim-1');
});

test('preservation chain requires provenance and checksum output', () => {
  const events = [
    createPreservationEvent({ event_id: 'e1', event_type: 'ACQUISITION', object_id: 'pdf1', provenance: { source: 'x' } }),
    createPreservationEvent({ event_id: 'e2', event_type: 'CHECKSUM', object_id: 'pdf1', output_hash: 'sha256:test', provenance: { source: 'x' } }),
  ];
  assert.equal(validatePreservationChain(events).valid, true);
});
