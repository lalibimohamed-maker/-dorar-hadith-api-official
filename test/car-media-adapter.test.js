import test from 'node:test';
import assert from 'node:assert/strict';
import { bluetoothAudioProfiles, planCarMedia, loadCarMediaConfig } from '../src/media/car-media-adapter.mjs';

test('Quran audio is available through Bluetooth and USB without generated speech', () => {
  for (const transport of ['bluetooth', 'usb']) {
    const result = planCarMedia({ transport, contentType: 'audio-quran' });
    assert.equal(result.allowed, true);
    assert.equal(result.generatedSpeech, false);
    assert.equal(result.mode, 'audio-first');
    assert.equal(result.preserveOriginal, true);
  }
  assert.ok(bluetoothAudioProfiles().includes('A2DP'));
  assert.ok(bluetoothAudioProfiles().includes('AVRCP'));
  assert.ok(bluetoothAudioProfiles().includes('LE-Audio-when-supported'));
});

test('Quran audio has free-first local playback engine preferences', () => {
  const config = loadCarMediaConfig();
  assert.deepEqual(config.quranAudio.playbackEnginePreference, ['GStreamer', 'mpv', 'platform-native']);
  assert.equal(config.freeFirst.paidCloudDependency, false);
});

test('local free-first playback engines are accepted by the planner', () => {
  for (const engine of ['GStreamer', 'mpv', 'platform-native']) {
    const result = planCarMedia({ transport: 'usb', contentType: 'audio-quran', engine });
    assert.equal(result.allowed, true);
    assert.equal(result.engine, engine);
  }
});

test('Bluetooth cannot be used as a video transport', () => {
  assert.deepEqual(planCarMedia({ transport: 'bluetooth', contentType: 'video', context: 'parked' }), {
    allowed: false,
    reason: 'bluetooth-audio-only'
  });
});

test('video is blocked while driving and may be planned while parked', () => {
  assert.deepEqual(planCarMedia({ transport: 'usb', contentType: 'video', context: 'driving' }), {
    allowed: false,
    reason: 'video-blocked-while-driving'
  });
  const parked = planCarMedia({ transport: 'usb', contentType: 'video', context: 'parked', nativeResolution: { width: 7680, height: 4320 }, engine: 'GStreamer' });
  assert.equal(parked.allowed, true);
  assert.equal(parked.mode, 'parked-video');
  assert.equal(parked.engine, 'GStreamer');
  assert.deepEqual(parked.nativeResolution, { width: 7680, height: 4320 });
});

test('unknown transports, content types, and engines fail closed', () => {
  assert.deepEqual(planCarMedia({ transport: 'unknown', contentType: 'audio-quran' }), { allowed: false, reason: 'unknown-transport' });
  assert.deepEqual(planCarMedia({ transport: 'usb', contentType: 'unknown' }), { allowed: false, reason: 'unsupported-content-type' });
  assert.deepEqual(planCarMedia({ transport: 'usb', contentType: 'audio-quran', engine: 'unknown-engine' }), { allowed: false, reason: 'unknown-playback-engine' });
});
