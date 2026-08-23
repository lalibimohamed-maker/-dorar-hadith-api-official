import assert from 'node:assert/strict';
import test from 'node:test';
import { rankEvidenceByQuality, scoreEvidencePath } from '../src/evidence-quality.js';

const sources = new Map([
  ['q', { id: 'q', type: 'quran' }],
  ['h', { id: 'h', type: 'hadith' }]
]);

const complete = {
  nodes: ['a', 'h'],
  edges: [{ id: 'e1', from: 'a', to: 'h' }],
  provenance: [{ sourceId: 'q', citation: 'c1' }]
};

test('returns transparent retrieval signals without making scholarly judgments', () => {
  const result = scoreEvidencePath(complete, sources);
  assert.equal(result.signals.sourceCoverage, 1);
  assert.equal(result.signals.provenanceCoverage, 1);
  assert.equal(result.signals.typedSources, 1);
  assert.ok(result.score > 0);
});

test('rewards broader source coverage while keeping depth visible', () => {
  const broader = {
    nodes: ['a', 'h', 't'],
    edges: [{ id: 'e1' }, { id: 'e2' }],
    provenance: [{ sourceId: 'q', citation: 'c1' }, { sourceId: 'h', citation: 'c2' }]
  };
  const ranked = rankEvidenceByQuality([complete, broader], sources);
  assert.equal(ranked[0].quality.signals.sourceCoverage, 2);
  assert.equal(ranked[1].quality.signals.sourceCoverage, 1);
});

test('does not call a source strong or authentic', () => {
  const result = scoreEvidencePath(complete, sources);
  assert.equal('authenticity' in result.signals, false);
  assert.equal('authority' in result.signals, false);
});
