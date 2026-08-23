import { strict as assert } from 'node:assert';
import {
  createMediaProviderRegistry,
  transcribe,
  synthesize,
  quranRecitation,
  exportMedia,
} from '../src/media-provider-adapters.js';

const provider = (capability, value) => ({
  supports: requested => requested === capability,
  async execute(input) { return { value, input }; },
});

const registry = createMediaProviderRegistry({
  speechToText: provider('speech-to-text', 'hello'),
  textToSpeech: provider('text-to-speech', 'audio'),
  quranRecitation: provider('quran-recitation', 'recitation'),
  export: provider('media-export', 'file'),
});

assert.equal(registry.speechToText !== null, true);
assert.equal((await transcribe({ provider: registry.speechToText, audio: 'x', language: 'th' })).value, 'hello');
assert.equal((await synthesize({ provider: registry.textToSpeech, text: 'x', language: 'th' })).value, 'audio');

const recitation = await quranRecitation({
  provider: registry.quranRecitation,
  surah: 1,
  ayah: 1,
});
assert.equal(recitation.input.language, 'ar');
assert.equal('reciter' in recitation.input, false);
assert.equal(recitation.input.verifiedOnly, true);

const selectedRecitation = await quranRecitation({
  provider: registry.quranRecitation,
  surah: 1,
  ayah: 1,
  reciter: 'Mishary Rashid Alafasy',
});
assert.equal(selectedRecitation.input.reciter, 'Mishary Rashid Alafasy');

const exported = await exportMedia({
  provider: registry.export,
  request: { format: 'mp3', sessionId: 'test', includeVoice: true },
});
assert.equal(exported.input.verifiedOnly, true);

await assert.rejects(() => transcribe({ provider: null, audio: 'x', language: 'ar' }));
