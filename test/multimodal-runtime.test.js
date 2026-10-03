import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSessionArtifact,
  createMultimodalSession,
  deviceCapabilityRequest,
  discoverProviderCapabilities,
  exportRequest,
  keyboardProfile,
  quranRecitationOffer,
  speechCapability,
  speechPolicy,
  sourceArtifactPolicy,
  validateExportManifest,
} from '../src/multimodal-runtime.js';

const verifiedSpeechProvider = {
  id: 'verified-speech-1',
  kind: 'speech',
  verified: true,
  capabilities: ['recognition', 'synthesis'],
  languages: ['ar-SA', 'fr-FR', 'ja-JP'],
};

const verifiedQuranAudioProvider = {
  id: 'verified-quran-audio-1',
  kind: 'audio',
  verified: true,
  authorized: true,
  capabilities: ['playback', 'download'],
  languages: ['ar'],
  reciters: ['Saad Al-Ghamdi'],
};

test('creates a localized multimodal session and preserves original input language state', () => {
  const session = createMultimodalSession({
    sessionId: 'session-1',
    originalUserText: 'مرحبا كيف حالك؟',
    detectedLanguage: 'ar-SA',
    settingsLanguage: 'ar',
    direction: 'rtl',
    providers: [verifiedSpeechProvider, verifiedQuranAudioProvider],
    provenance: {
      citations: ['cite-1'],
      sourceReferences: ['source-1'],
      sourceVerified: true,
    },
  });

  assert.equal(session.schemaVersion, 2);
  assert.equal(session.input.originalUserText, 'مرحبا كيف حالك؟');
  assert.equal(session.input.detectedLanguage, 'ar-SA');
  assert.equal(session.language, 'ar-SA');
  assert.equal(session.direction, 'rtl');
  assert.equal(session.input.modes.join(','), 'text,keyboard,voice');
  assert.equal(session.output.voice.capability.available, true);
});

test('canonicalizes BCP-47 tags without a finite language list', () => {
  const session = createMultimodalSession({ language: 'th-th', originalUserText: 'สวัสดี' });
  assert.equal(session.language, 'th-TH');
});

test('invalid language input uses an explicit fallback instead of inventing support', () => {
  const state = createMultimodalSession({
    originalUserText: 'hello',
    detectedLanguage: 'not_a_language',
    settingsLanguage: 'en',
  });
  assert.equal(state.input.detectedLanguage, 'en');
  assert.equal(state.input.languageSource, 'settings-fallback');
});

test('provider capability discovery returns only verified providers', () => {
  const capabilities = discoverProviderCapabilities(
    [
      verifiedSpeechProvider,
      { id: 'unverified', verified: false, capabilities: ['synthesis'], languages: ['en'] },
    ],
    'fr-FR',
  );

  assert.equal(capabilities.length, 1);
  assert.equal(capabilities[0].id, 'verified-speech-1');
  assert.equal(capabilities[0].supportsLanguage, true);
});

test('missing speech capability is surfaced without silent language switching', () => {
  const capability = speechCapability({
    language: 'de-DE',
    providers: [verifiedSpeechProvider],
    mode: 'synthesis',
  });

  assert.equal(capability.available, false);
  assert.match(capability.reason, /do not silently switch languages/);
  assert.equal(capability.fallback, 'ui-notice-and-explicit-fallback');
});

test('localizes non-Quran speech output to the user language', () => {
  const policy = speechPolicy({
    language: 'fr-FR',
    providers: [verifiedSpeechProvider],
  });
  assert.equal(policy.mode, 'localized-answer');
  assert.equal(policy.language, 'fr-FR');
  assert.equal(policy.capability.available, true);
});

test('keyboard profile follows Settings and supports RTL, IME, custom layouts and voice input', () => {
  const profile = keyboardProfile('ar-SA', {
    settingsLanguage: 'ar',
    imeComposition: true,
    customLayouts: true,
    voiceInput: true,
  });

  assert.equal(profile.language, 'ar-SA');
  assert.equal(profile.settingsLanguage, 'ar');
  assert.equal(profile.direction, 'rtl');
  assert.equal(profile.imeComposition, true);
  assert.equal(profile.customLayouts, true);
  assert.equal(profile.voiceInput.language, 'ar-SA');
});

test('keeps Quran recitation Arabic and never translates it', () => {
  const policy = speechPolicy({ language: 'fr-FR', isQuran: true });
  assert.deepEqual(policy, {
    mode: 'arabic-recitation-only',
    language: 'ar',
    reciter: 'Saad Al-Ghamdi',
    translateRecitation: false,
    capability: null,
  });
});

test('Quran playback/download require a verified authorized Saad Al-Ghamdi source', () => {
  const denied = quranRecitationOffer({
    providers: [{ ...verifiedQuranAudioProvider, authorized: false }],
    action: 'playback',
  });
  assert.equal(denied.available, false);

  const allowed = quranRecitationOffer({
    providers: [verifiedQuranAudioProvider],
    action: 'download',
  });
  assert.equal(allowed.available, true);
  assert.equal(allowed.reciter, 'Saad Al-Ghamdi');
  assert.equal(allowed.language, 'ar');
});

test('session artifacts inherit question, answer language, citations and provenance', () => {
  const session = createMultimodalSession({
    sessionId: 'session-2',
    originalUserText: 'What is this?',
    detectedLanguage: 'en-US',
    provenance: {
      citations: ['citation-1'],
      sourceReferences: ['source-2'],
      sourceVerified: true,
    },
  });

  const artifact = buildSessionArtifact({
    session,
    kind: 'audio',
    payload: { mediaId: 'media-1' },
  });

  assert.equal(artifact.originalQuestion, 'What is this?');
  assert.equal(artifact.detectedLanguage, 'en-US');
  assert.equal(artifact.answerLanguage, 'en-US');
  assert.deepEqual(artifact.citations, ['citation-1']);
  assert.deepEqual(artifact.sourceReferences, ['source-2']);
  assert.equal(artifact.provenance.sourceVerified, true);
});

test('exports are verified-provider gated and preserve provenance fields', () => {
  const request = exportRequest({
    format: 'mp3',
    sessionId: 'session-3',
    includeVoice: true,
    originalQuestion: 'Explain this',
    answerLanguage: 'id-ID',
    citations: ['cite-1'],
    sourceReferences: ['source-1'],
    provenance: { sourceVerified: true },
  });

  assert.equal(request.verifiedOnly, true);
  assert.equal(request.status, 'requires-provider');
  assert.equal(request.originalQuestion, 'Explain this');
  assert.equal(request.answerLanguage, 'id-ID');
  assert.deepEqual(request.citations, ['cite-1']);
  assert.deepEqual(request.sourceReferences, ['source-1']);
});

test('rejects invalid export combinations and unknown formats', () => {
  assert.throws(() => exportRequest({ format: 'wav', sessionId: 'session-1' }), /Unsupported export format/);
  assert.throws(() => exportRequest({
    format: 'pdf',
    sessionId: 'session-1',
    includeVoice: true,
  }), /includeVoice is supported only/);
  assert.throws(() => exportRequest({
    format: 'mp3',
    sessionId: 'session-1',
    includeVideo: true,
  }), /includeVideo requires/);
});

test('export validation blocks fabricated Quran recitation, source, citation and attribution', () => {
  const valid = validateExportManifest({
    sessionId: 'session-4',
    format: 'mp4-4k',
    originalQuestion: 'Explain',
    answerLanguage: 'en',
    citations: [],
    sourceReferences: [],
    verifiedOnly: true,
  });
  assert.equal(valid.valid, true);

  for (const key of ['fabricatedQuranRecitation', 'fabricatedCitation', 'fabricatedSource', 'fabricatedAttribution']) {
    const blocked = validateExportManifest({
      sessionId: 'session-4',
      format: 'mp4-4k',
      originalQuestion: 'Explain',
      answerLanguage: 'en',
      citations: [],
      sourceReferences: [],
      verifiedOnly: true,
      [key]: true,
    });
    assert.equal(blocked.valid, false, key);
  }
});

test('device controls require platform permission and explicit user opt-in', () => {
  const denied = deviceCapabilityRequest({
    platform: 'ios',
    capability: 'microphone',
    permissionGranted: false,
    userOptIn: true,
  });
  assert.equal(denied.allowed, false);

  const allowed = deviceCapabilityRequest({
    platform: 'android',
    capability: 'notifications',
    permissionGranted: true,
    userOptIn: true,
  });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.permissionGated, true);
});

test('external media never becomes a religious source merely by discovery', () => {
  const policy = sourceArtifactPolicy({
    sourceType: 'external-media',
    contentKind: 'quran',
  });
  assert.equal(policy.religiousSource, false);
});

test('rejects unsupported device capabilities', () => {
  const result = deviceCapabilityRequest({
    platform: 'web',
    capability: 'camera',
    permissionGranted: true,
    userOptIn: true,
  });
  assert.equal(result.allowed, false);
});
