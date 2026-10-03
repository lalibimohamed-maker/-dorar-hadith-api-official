const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'config/video-prototypes/global-multilingual-voice-engine-2026.json');
const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));

test('global voice engine registry exists and is quality gated', () => {
  expect(cfg.status).toBe('prototype_registry');
  expect(cfg.qualityPolicy.rejectUnintelligibleAudio).toBe(true);
  expect(cfg.qualityPolicy.requireNativeLanguageEvaluation).toBe(true);
  expect(cfg.qualityPolicy.requireAssetLicenseReview).toBe(true);
  expect(cfg.qualityPolicy.humanFallbackWhenNoModelMeetsThreshold).toBe(true);
});

test('required engine families are registered', () => {
  const ids = cfg.engines.map((e) => e.id);
  expect(ids).toEqual(expect.arrayContaining([
    'chatterbox-multilingual-v3',
    'qwen3-tts',
    'piper',
    'facebook-mms-tts',
    'seamlessm4t-v2',
  ]));
});

test('hard noncommercial gates are explicit', () => {
  for (const id of ['facebook-mms-tts', 'seamlessm4t-v2']) {
    const engine = cfg.engines.find((e) => e.id === id);
    expect(engine.licenseGate).toMatch(/noncommercial/i);
  }
});

test('Quranic recitation is separated from narrator TTS', () => {
  expect(cfg.quranPolicy.ttsRecitation).toBe('forbidden');
  expect(cfg.quranPolicy.recitationRoute).toBe('licensed_verified_quran_recitation_only');
});

test('provenance fields are complete enough for reproducibility', () => {
  expect(cfg.provenance.storeWithVideo).toBe(true);
  expect(cfg.provenance.requiredFields).toEqual(expect.arrayContaining([
    'engine', 'engineVersion', 'modelCheckpoint', 'voiceId', 'voiceLanguage',
    'voiceLicense', 'textHash', 'ssmlHash', 'lexiconVersion', 'generationTimestamp', 'qaResult'
  ]));
});
