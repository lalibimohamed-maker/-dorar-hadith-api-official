import assert from 'node:assert/strict';
import test from 'node:test';
import { explainEvidenceQuality, toEvidenceResult, toEvidenceResults } from '../src/evidence-result.js';

test('exposes quality signals without turning them into scholarly judgments', () => {
  const result = explainEvidenceQuality({ score: 2.5, signals: { sourceCoverage: 2, provenanceCoverage: 1, depth: 2 } });
  assert.equal(result.score, 2.5);
  assert.equal(result.signals.sourceCoverage, 2);
  assert.ok(result.explanation.some(item => item.key === 'sourceCoverage'));
  assert.equal('authenticity' in result.signals, false);
  assert.equal('authority' in result.signals, false);
});

test('normalizes an evidence path into a stable result contract', () => {
  const result = toEvidenceResult({ nodes: ['a'], edges: [], provenance: [], quality: { score: 1, signals: { depth: 0 } } });
  assert.deepEqual(result.nodes, ['a']);
  assert.deepEqual(result.edges, []);
  assert.deepEqual(result.provenance, []);
  assert.equal(result.quality.signals.depth, 0);
});

test('maps multiple evidence paths', () => {
  const results = toEvidenceResults([{ nodes: ['a'], quality: { score: 1, signals: {} } }, { nodes: ['b'], quality: { score: 2, signals: {} } }]);
  assert.equal(results.length, 2);
  assert.deepEqual(results.map(item => item.nodes[0]), ['a', 'b']);
});
