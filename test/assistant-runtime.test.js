import test from 'node:test';
import { strict as assert } from 'node:assert';
import { runAssistantSearch, runVoiceQuestion, exportAssistantSession } from '../src/assistant-runtime.js';

const speechProvider = {
  supports: capability => capability === 'speech-to-text',
  async execute() { return { text: 'اختبار البحث' }; },
};

const exportProvider = {
  supports: capability => capability === 'media-export',
  async execute(input) { return { ok: true, input }; },
};

const searchStub = async (query, options) => ({
  query,
  responseLanguage: options.responseLocale,
  sourceMatches: [],
});

const result = await runAssistantSearch({ query: 'من هو أبو بكر الصديق؟', language: 'ar', searchFn: searchStub });
assert.equal(result.search.responseLanguage, 'ar');
assert.equal(result.session.language, 'ar');
assert.equal(result.capabilities.voiceInput, false);

const voice = await runVoiceQuestion({ provider: speechProvider, audio: Buffer.from('test'), language: 'ar', searchFn: searchStub });
assert.equal(voice.transcript.text, 'اختبار البحث');
assert.equal(voice.search.responseLanguage, 'ar');

const exported = await exportAssistantSession({
  provider: exportProvider,
  format: 'pdf',
  sessionId: 'session-test',
});
assert.equal(exported.ok, true);
assert.equal(exported.input.verifiedOnly, true);

const omegaSearchStub = async (query, options) => ({
  query,
  responseLanguage: options.responseLocale,
  hadith: { text: 'verified test evidence' },
  sourceMatches: [{ id: 'src-1', title: 'Test source', verification: 'verified', source: 'test://' }],
});

test('assistant can invoke Omega as a governed opt-in layer', async () => {
  const result = await runAssistantSearch({
    query: 'اختبار',
    language: 'ar',
    searchFn: omegaSearchStub,
    useOmega: true,
    executeOmega: false,
    omegaOptions: { availableBackends: ['openai-compatible'] }
  });
  assert.equal(result.capabilities.omega, true);
  assert.equal(result.omega.plan.task, 'scholarly_answer');
  assert.equal(result.omega.plan.status, 'ready');
  assert.equal(result.omega.backend.backend, 'openai-compatible');
  assert.equal(result.omega.provenance.corpus_write, false);
});

test('assistant preserves legacy search-only mode by default', async () => {
  const result = await runAssistantSearch({ query:'اختبار', language:'ar', searchFn:searchStub });
  assert.equal(result.capabilities.omega, false);
  assert.equal('omega' in result, false);
});


test('assistant can add provenance-bearing GraphRAG retrieval to Omega evidence', async () => {
  const graphRagRuntime = {
    async search() {
      return [{ id: 'graph-1', payload: { sourceId: 'graph-source', text: 'Graph evidence', verification: 'source_verified', provenance: { citation: 'p.2' } } }];
    }
  };
  const result = await runAssistantSearch({
    query: 'اختبار GraphRAG',
    language: 'ar',
    searchFn: omegaSearchStub,
    useOmega: true,
    executeOmega: false,
    graphRagRuntime,
    omegaOptions: { availableBackends: ['openai-compatible'] }
  });
  assert.equal(result.omega.graphRag.enabled, true);
  assert.equal(result.omega.graphRag.results, 1);
  assert.equal(result.omega.plan.status, 'ready');
});
