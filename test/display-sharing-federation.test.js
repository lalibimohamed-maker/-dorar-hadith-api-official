import test from 'node:test';
import assert from 'node:assert/strict';
import { listProtocolsForDevice, negotiateResolution, validate24KClaim } from '../src/media/display-sharing-federation.mjs';

test('all major device classes have protocol candidates', () => {
  for (const deviceClass of ['television','computer','projector','iphone-ipad','android-phone-tablet','embedded']) {
    assert.ok(listProtocolsForDevice(deviceClass).length > 0, deviceClass);
  }
});

test('resolution negotiation never exceeds the smallest probed capability', () => {
  assert.deepEqual(negotiateResolution({ source: 15360, sink: 7680, requested: 24000 }), {
    allowed: true,
    requestedLongEdge: 24000,
    negotiatedLongEdge: 7680,
    derivedFromHigherRequest: true
  });
});

test('missing capability probes fail closed', () => {
  assert.deepEqual(negotiateResolution({ source: 7680, sink: null, requested: 7680 }), {
    allowed: false,
    reason: 'missing-capability-probe'
  });
});

test('24K is never called native without native target capability', () => {
  assert.deepEqual(validate24KClaim({ targetWidth: 24000, targetHeight: 13500, native: false }), {
    allowed: false,
    reason: '24K-is-derived-not-native'
  });
});

test('native 24K requires a target actually reporting 24K geometry', () => {
  assert.deepEqual(validate24KClaim({ targetWidth: 24000, targetHeight: 13500, native: true }), {
    allowed: true,
    reason: 'native-target-capability-verified'
  });
});
