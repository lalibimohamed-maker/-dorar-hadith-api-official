import test from 'node:test';
import assert from 'node:assert/strict';
import { createResearchObjectCrate } from '../src/rechercher-research-object-crate-engine.js';

test('creates a RO-Crate 1.2 metadata graph with provenance and entities', () => {
  const crate = createResearchObjectCrate({ crateId: 'crate:1', name: 'Rechercher Research Object', entities: [{ id: 'pdf:1', type: 'File', contentHash: 'sha256:x' }], provenance: [{ id: 'event:1', object: 'pdf:1' }] });
  assert.equal(crate['@context'], 'https://w3id.org/ro/crate/1.2/context');
  assert.ok(crate['@graph'].some(x => x['@id'] === 'pdf:1'));
  assert.ok(crate['@graph'].some(x => x['@id'] === 'event:1'));
});
