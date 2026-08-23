import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProvenanceRegistry, registerCitation, registerSource, validateCitation, validateSource } from '../src/source-provenance-registry.js';

const source = { id: 'src1', title: 'Recorded source', type: 'hadith' };
const citation = { id: 'cit1', sourceId: 'src1', locator: 'vol:1,page:2' };

test('validates typed sources', () => {
  assert.equal(validateSource(source).valid, true);
  assert.equal(validateSource({ ...source, type: 'invented' }).valid, false);
});

test('requires a registered source for citations', () => {
  assert.equal(validateCitation(citation, new Map([['src1', source]])).valid, true);
  assert.equal(validateCitation(citation, new Map()).valid, false);
});

test('rejects duplicate sources and citations', () => {
  const sources = new Map();
  registerSource(sources, source);
  assert.throws(() => registerSource(sources, source), /Duplicate source/);
  const citations = new Map();
  registerCitation(citations, sources, citation);
  assert.throws(() => registerCitation(citations, sources, citation), /Duplicate citation/);
});

test('rejects generated citations as provenance', () => {
  assert.throws(() => registerCitation(new Map(), new Map([['src1', source]]), { ...citation, generated: true }), /generated-citation-not-allowed/);
});

test('builds linked source and citation registries', () => {
  const registry = buildProvenanceRegistry([source], [citation]);
  assert.equal(registry.sources.length, 1);
  assert.equal(registry.citations.length, 1);
  assert.equal(registry.citations[0].sourceId, 'src1');
});
