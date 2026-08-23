import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMultimodalSession,
  exportRequest,
  keyboardProfile,
  speechPolicy,
} from '../src/multimodal-runtime.js';

test('creates a localized multimodal session', () => {
  const session = createMultimodalSession({ language: 'th-TH', direction: 'ltr' });
  assert.equal(session.language, 'th-TH');
  assert.equal(session.input.voice, true);
  assert.equal(session.input.keyboard, true);
  assert.equal(session.output.quranRecitation.language, 'ar');
  assert.equal(session.output.quranRecitation.reciter, 'Saad Al-Ghamdi');
});

test('keeps Quran recitation Arabic and identifies the configured reciter', () => {
  const policy = speechPolicy({ language: 'fr-FR', isQuran: true });
  assert.deepEqual(policy, {
    mode: 'arabic-recitation-only',
    language: 'ar',
    reciter: 'Saad Al-Ghamdi',
    translateRecitation: false,
  });
});

test('localizes non-Quran speech output to the user language', () => {
  const policy = speechPolicy({ language: 'fil-PH' });
  assert.equal(policy.mode, 'localized-answer');
  assert.equal(policy.language, 'fil-PH');
});

test('keyboard profile follows the requested language and supports voice input', () => {
  const profile = keyboardProfile('ja-JP', { direction: 'ltr' });
  assert.equal(profile.language, 'ja-JP');
  assert.equal(profile.voiceInput.enabled, true);
  assert.equal(profile.composition, true);
  assert.equal(profile.customLayouts, true);
});

test('exports are explicitly verified-provider gated', () => {
  const request = exportRequest({ format: 'mp3', sessionId: 'session-1', includeVoice: true });
  assert.equal(request.verifiedOnly, true);
  assert.equal(request.status, 'requires-provider');
});

test('rejects unknown export formats', () => {
  assert.throws(() => exportRequest({ format: 'wav', sessionId: 'session-1' }), /Unsupported export format/);
});
