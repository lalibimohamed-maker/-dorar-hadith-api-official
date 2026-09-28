import test from 'node:test';
import assert from 'node:assert/strict';
import { routeIntent } from '../src/ai/agent-intent-router.mjs';
import { buildEvidenceContext } from '../src/ai/evidence-context-builder.mjs';
import { verifyAgentResponse } from '../src/ai/response-verifier.mjs';
import { runAgent, retrieveAgentEvidence } from '../src/ai/agent-runtime.mjs';

test('intent router distinguishes common religious question types', () => {
  assert.equal(routeIntent('ما حكم زكاة المال؟').intent, 'fiqh');
  assert.equal(routeIntent('هل هذا الحديث صحيح؟').intent, 'hadith');
  assert.equal(routeIntent('ما تفسير هذه الآية من سورة البقرة؟').intent, 'quran');
  assert.equal(routeIntent('من هو الراوي فلان؟ وما حاله؟').intent, 'rijal');
});

test('evidence context preserves source, location and rights', () => {
  const result = buildEvidenceContext({
    sourceMatches: [{
      id: 'book:1',
      text: 'دليل تجريبي',
      source: 'https://example.invalid/source',
      page: 10,
      verification: 'verified',
      rights: 'catalog-only'
    }]
  });
  assert.equal(result.evidence.length, 1);
  assert.equal(result.evidence[0].source, 'https://example.invalid/source');
  assert.equal(result.evidence[0].location, '10');
  assert.equal(result.evidence[0].rights, 'catalog-only');
});

test('response verifier rejects invented citations and unsupported answers', () => {
  const evidence = [{ citationId: 'E1', text: 'proof', source: 'source', verification: 'verified', rights: 'ok' }];
  assert.equal(verifyAgentResponse({ answer: 'answer [E9]', evidence }).status, 'rejected');
  assert.equal(verifyAgentResponse({ answer: 'answer', evidence }).status, 'rejected');
  assert.equal(verifyAgentResponse({ answer: 'answer [E1]', evidence }).status, 'verified-structure');
});

test('semantic retrieval and reranking can be exercised without real model weights', async () => {
  const searchResult = {
    sourceMatches: [
      { id: 'source:1', text: 'إجابة عن الحج', source: 'source:1', verification: 'verified', rights: 'catalog-only' },
      { id: 'source:2', text: 'إجابة عن الصلاة', source: 'source:2', verification: 'verified', rights: 'catalog-only' }
    ]
  };
  const result = await retrieveAgentEvidence({
    query: 'الحج',
    searchResult,
    env: { DEEN_EMBEDDING_MODEL_PATH: 'fixture.gguf', DEEN_RERANKER_MODEL_PATH: 'fixture.gguf' },
    embedFn: async ({ texts }) => ({
      embeddings: texts.map((value, index) => index === 0 ? [1, 0] : value.includes('الحج') ? [1, 0] : [0, 1])
    }),
    rerankFn: async ({ documents }) => documents.map((document, index) => ({ document, score: documents.length - index }))
  });
  assert.equal(result.retrieval.semantic.active, true);
  assert.equal(result.retrieval.reranker.active, true);
  assert.equal(result.evidence[0].id, 'source:1');
});

test('agent executes model-tools-evidence-verification loop with injected generator', async () => {
  const fakeSearch = async () => ({
    sourceMatches: [{
      id: 'source:1',
      text: 'The evidence says exactly this.',
      source: 'https://example.invalid/evidence',
      location: 'p. 12',
      verification: 'verified',
      rights: 'catalog-only'
    }],
    policy: { sourceAttributionRequired: true }
  });
  const result = await runAgent({
    query: 'Explain this hadith',
    language: 'en',
    searchFn: fakeSearch,
    generateFn: async () => ({
      modelId: 'fixture-model',
      text: '{"answer":"The evidence says exactly this. [E1]","citations":["E1"]}'
    })
  });
  assert.equal(result.generated, true);
  assert.equal(result.verification.status, 'verified-structure');
  assert.deepEqual(result.verification.citations, ['E1']);
});
