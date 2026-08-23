import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEvidenceQualitySummary, explainSearchResult } from '../src/search-quality-explanation.js';

test('explains retrieval signals without scholarly claims', () => {
  const result = explainSearchResult({ id: 'h1', title: 'Example', quality: { signals: { sourceCoverage: 2, provenanceCoverage: 1, typedSources: 2, depth: 2 } } });
  assert.equal(result.id, 'h1');
  assert.equal(result.explanation.source_coverage, 2);
  assert.match(result.note, /do not determine authenticity/);
});

test('builds ranked path summaries with explicit signals', () => {
  const paths = [{ nodes: ['a', 'b'], edges: [{ id: 'e' }], provenance: [{ sourceId: 's', citation: 'c' }] }];
  const summary = buildEvidenceQualitySummary(paths, new Map([['s', { id: 's', type: 'hadith' }]]));
  assert.equal(summary.length, 1);
  assert.equal(summary[0].rank, 1);
  assert.equal(summary[0].explanation.source_coverage, 1);
});
