import assert from 'node:assert/strict';
import test from 'node:test';
import { buildQuranHadithContextNetwork, createQuranHadithContextRelation, findContextRelations, validateQuranHadithContextNode } from '../src/quran-hadith-context-network.js';

const ayah = { id: 'a1', kind: 'ayah', sourceId: 'quran-source', citation: '2:255' };
const hadith = { id: 'h1', kind: 'hadith', sourceId: 'hadith-source', citation: 'record:1' };

test('requires typed source-backed context nodes', () => {
  assert.equal(validateQuranHadithContextNode(ayah).valid, true);
  assert.equal(validateQuranHadithContextNode({ ...ayah, kind: 'invented' }).valid, false);
  assert.equal(validateQuranHadithContextNode({ ...ayah, generated: true }).valid, false);
});

test('requires provenance and an allow-listed relation type', () => {
  assert.equal(createQuranHadithContextRelation({ id: 'r1', from: 'a1', to: 'h1', type: 'relates_to', sourceId: 'link-source', citation: '1' }).type, 'relates_to');
  assert.throws(() => createQuranHadithContextRelation({ id: 'r2', from: 'a1', to: 'h1', type: 'invented', sourceId: 's', citation: '2' }), /unknown-type/);
  assert.throws(() => createQuranHadithContextRelation({ id: 'r3', from: 'a1', to: 'h1', type: 'supports' }), /missing-provenance/);
});

test('builds a cross-domain Quran/Hadith graph without merging source identities', () => {
  const graph = buildQuranHadithContextNetwork([ayah, hadith], [
    { id: 'r4', from: 'a1', to: 'h1', type: 'relates_to', sourceId: 'link-source', citation: '1' }
  ]);
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 1);
  assert.equal(findContextRelations(graph, 'a1')[0].to, 'h1');
});

test('rejects relations to nodes absent from the graph', () => {
  assert.throws(() => buildQuranHadithContextNetwork([ayah], [
    { id: 'r5', from: 'a1', to: 'missing', type: 'relates_to', sourceId: 's', citation: '5' }
  ]), /Unknown context node/);
});
