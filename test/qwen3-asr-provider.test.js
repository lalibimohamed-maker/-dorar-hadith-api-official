import { strict as assert } from 'node:assert';
import { createQwen3ASRProvider } from '../src/qwen3-asr-provider.js';

const provider = createQwen3ASRProvider({
  modelPath: '/models/Qwen3-ASR-0.6B',
});

assert.equal(provider.supports('speech-to-text'), true);
assert.equal(provider.supports('language-identification'), true);
assert.equal(provider.supports('text-to-speech'), false);
