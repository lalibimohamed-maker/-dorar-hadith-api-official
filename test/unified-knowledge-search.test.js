import assert from 'node:assert/strict';
import test from 'node:test';
import { unifiedKnowledgeSearch, explainKnowledgeResult, resolveKnowledgeConcept } from '../src/unified-knowledge-search.js';

const records = [
  { id: 'a1', title_ar: 'الصلاة', text: 'أقيموا الصلاة', sourceId: 'quran', sourceType: 'quran', verification_state: 'verified' },
  { id: 'h1', title_ar: 'حديث الصلاة', text: 'صلوا كما رأيتموني أصلي', sourceId: 'hadith', sourceType: 'hadith', verification_state: 'verified' }
];

const graph = {
  nodes: [
    { id: 'a1', kind: 'ayah' },
    { id: 'h1', kind: 'hadith' },
    { id: 't1', kind: 'tafsir' }
  ],
  edges: [
    { id: 'e1', from: 'a1', to: 'h1', type: 'supports', sourceId: 'src1', citation: 'c1' },
    { id: 'e2', from: 'h1', to: 't1', type: 'explains', sourceId: 'src2', citation: 'c2' }
  ]
};

test('combines corpus results with provenance-aware graph paths', () => {
  const result = unifiedKnowledgeSearch('الصلاة', { limit: 1, startId: 'a1', targetIds: ['h1'], maxDepth: 2 }, records, graph);
  assert.equal(result.mode, 'corpus+graph');
  assert.equal(result.results.length, 1);
  assert.equal(result.evidence_paths.length, 1);
  assert.deepEqual(result.evidence_paths[0].provenance, [{ sourceId: 'src1', citation: 'c1' }]);
});

test('keeps corpus-only search available when graph is absent', () => {
  const result = unifiedKnowledgeSearch('الصلاة', { limit: 1 }, records);
  assert.equal(result.mode, 'corpus');
  assert.equal(result.evidence_paths.length, 0);
  assert.equal(result.results.length, 1);
});

test('explains a graph result without generating source content', () => {
  const result = explainKnowledgeResult({ id: 'a1' }, graph, { targetId: 'h1' });
  assert.equal(result.evidence_paths.length, 1);
  assert.equal(result.evidence_paths[0].edges[0].sourceId, 'src1');
});

test('preserves concept resolution through the existing resolver', () => {
  const card = resolveKnowledgeConcept('الصلاة', null, 'ar', records);
  assert.equal(card.term, 'الصلاة');
});
