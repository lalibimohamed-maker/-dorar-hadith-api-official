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
