import test from 'node:test';
import assert from 'node:assert/strict';
import { bluetoothAudioProfiles, planCarMedia } from '../src/media/car-media-adapter.mjs';

test('Quran audio is available through Bluetooth and USB without generated speech', () => {
  for (const transport of ['bluetooth', 'usb']) {
    const result = planCarMedia({ transport, contentType: 'audio-quran' });
    assert.equal(result.allowed, true);
    assert.equal(result.generatedSpeech, false);
    assert.equal(result.mode, 'audio-first');
  }
  assert.ok(bluetoothAudioProfiles().includes('A2DP'));
  assert.ok(bluetoothAudioProfiles().includes('AVRCP'));
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
  const parked = planCarMedia({ transport: 'usb', contentType: 'video', context: 'parked', nativeResolution: { width: 7680, height: 4320 } });
  assert.equal(parked.allowed, true);
  assert.equal(parked.mode, 'parked-video');
  assert.deepEqual(parked.nativeResolution, { width: 7680, height: 4320 });
});

test('unknown transports and content types fail closed', () => {
  assert.deepEqual(planCarMedia({ transport: 'unknown', contentType: 'audio-quran' }), { allowed: false, reason: 'unknown-transport' });
  assert.deepEqual(planCarMedia({ transport: 'usb', contentType: 'unknown' }), { allowed: false, reason: 'unsupported-content-type' });
});
