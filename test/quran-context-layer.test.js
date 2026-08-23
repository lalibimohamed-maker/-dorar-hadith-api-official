import assert from 'node:assert/strict';
import test from 'node:test';
import { buildQuranContextLayer, createQuranContextRelation, getQuranContext, validateQuranContextNode } from '../src/quran-context-layer.js';

const ayah = { id: 'a1', kind: 'ayah', sourceId: 'quran', citation: '2:255' };
const tafsir = { id: 't1', kind: 'tafsir', sourceId: 'tafsir-src', citation: 'tafsir:2:255' };
const sabab = { id: 's1', kind: 'asbab_al_nuzul', sourceId: 'sabab-src', citation: 'sabab:2:255' };
const sirah = { id: 'sir1', kind: 'sirah', sourceId: 'sirah-src', citation: 'sirah:event-1' };

test('accepts typed source-backed Quran context nodes', () => {
  assert.equal(validateQuranContextNode(ayah).valid, true);
  assert.equal(validateQuranContextNode({ ...tafsir, kind: 'unknown' }).valid, false);
  assert.equal(validateQuranContextNode({ ...sabab, generated: true }).valid, false);
});

test('requires provenance for context relations', () => {
  assert.equal(createQuranContextRelation({ id: 'r1', from: 'a1', to: 't1', type: 'explains', sourceId: 'link', citation: '1' }).type, 'explains');
  assert.throws(() => createQuranContextRelation({ id: 'r2', from: 'a1', to: 't1', type: 'invented', sourceId: 'link', citation: '2' }), /unknown-type/);
  assert.throws(() => createQuranContextRelation({ id: 'r3', from: 'a1', to: 't1', type: 'supports' }), /missing-provenance/);
});

test('builds ayah-to-tafsir-sabab-sirah context without merging source texts', () => {
  const graph = buildQuranContextLayer([ayah, tafsir, sabab, sirah], [
    { id: 'r1', from: 'a1', to: 't1', type: 'explains', sourceId: 'link', citation: '1' },
    { id: 'r2', from: 'a1', to: 's1', type: 'has_revelation_context', sourceId: 'link', citation: '2' },
    { id: 'r3', from: 'a1', to: 'sir1', type: 'has_sirah_context', sourceId: 'link', citation: '3' }
  ]);
  assert.equal(graph.nodes.length, 4);
  assert.equal(getQuranContext(graph, 'a1').length, 3);
});

test('rejects orphan relation endpoints', () => {
  assert.throws(() => buildQuranContextLayer([ayah], [
    { id: 'r4', from: 'a1', to: 'missing', type: 'explains', sourceId: 'link', citation: '4' }
  ]), /Unknown Quran context node/);
});
