import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHadithVariantNetwork, createHadithRelation, registerHadithVariant, validateHadithVariant } from '../src/hadith-variants-network.js';

const variant = (id, text = 'recorded text') => ({
  id, hadithId: 'h1', text, sourceId: 'src1', citation: `book:${id}`
});

test('requires source and citation for every variant', () => {
  assert.equal(validateHadithVariant(variant('v1')).valid, true);
  assert.equal(validateHadithVariant({ ...variant('v2'), citation: '' }).valid, false);
});

test('rejects generated variants and duplicate identities', () => {
  const registry = new Map();
  registerHadithVariant(registry, variant('v1'));
  assert.throws(() => registerHadithVariant(registry, variant('v1')), /Duplicate hadith variant/);
  assert.throws(() => registerHadithVariant(registry, { ...variant('v2'), generated: true }), /generated-content-not-allowed/);
});

test('relations require an allowed type and provenance', () => {
  assert.deepEqual(createHadithRelation({ id: 'r1', from: 'v1', to: 'v2', type: 'variant_of', sourceId: 'src1', citation: '1' }).type, 'variant_of');
  assert.throws(() => createHadithRelation({ id: 'r2', from: 'v1', to: 'v2', type: 'invented', sourceId: 'src1', citation: '2' }), /Invalid relation:type/);
  assert.throws(() => createHadithRelation({ id: 'r3', from: 'v1', to: 'v2', type: 'variant_of' }), /missing-provenance/);
});

test('builds a provenance-aware variant network', () => {
  const graph = buildHadithVariantNetwork(
    [variant('v1', 'wording one'), variant('v2', 'wording two')],
    [{ id: 'r1', from: 'v2', to: 'v1', type: 'variant_of', sourceId: 'src1', citation: 'book:v2' }]
  );
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 1);
});

test('rejects edges pointing to unknown variants', () => {
  assert.throws(() => buildHadithVariantNetwork(
    [variant('v1')],
    [{ id: 'r4', from: 'v1', to: 'missing', type: 'variant_of', sourceId: 'src1', citation: '4' }]
  ), /unknown-node/);
});
