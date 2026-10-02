import { strict as assert } from 'node:assert';
import { runAssistantSearch, runVoiceQuestion, runEngineDialogue, exportAssistantSession } from '../src/assistant-runtime.js';

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

const dialogue = await runEngineDialogue({
  engineA: { async respond(message) { return { content: `A received: ${message.content}` }; } },
  engineB: { async respond(message) { return { content: `B received: ${message.content}` }; } },
  initialMessage: 'ابدآ الحوار',
  maxTurns: 4,
  timeoutMs: 1000,
});
assert.equal(dialogue.status, 'max-turns');
assert.equal(dialogue.turns.length, 4);
assert.equal(dialogue.turns[0].engineId, 'engine-a');
assert.equal(dialogue.turns[1].engineId, 'engine-b');
assert.equal(dialogue.turns[0].role, 'engine-a');

const stopped = await runEngineDialogue({
  engineA: { async respond(message) { return { content: 'A' }; } },
  engineB: { async respond(message) { return { content: 'B' }; } },
  initialMessage: 'ابدأ',
  maxTurns: 4,
  shouldStop: () => true,
});
assert.equal(stopped.status, 'user-stop');
assert.equal(stopped.turns.length, 0);

const looped = await runEngineDialogue({
  engineA: { async respond() { return { content: 'same' }; } },
  engineB: { async respond() { return { content: 'same' }; } },
  initialMessage: 'ابدأ',
  maxTurns: 4,
});
assert.equal(looped.status, 'loop-detected');
assert.equal(looped.turns.length, 1);

const exported = await exportAssistantSession({
  provider: exportProvider,
  format: 'pdf',
  sessionId: 'session-test',
});
assert.equal(exported.ok, true);
assert.equal(exported.input.verifiedOnly, true);
