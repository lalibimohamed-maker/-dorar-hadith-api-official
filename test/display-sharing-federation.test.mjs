import test from 'node:test';
import assert from 'node:assert/strict';
import { listProtocolsForDevice, negotiateResolution, validateNativeClaim } from '../src/media/display-sharing-federation.mjs';

const majorDevices = ['television', 'monitor', 'projector', 'computer', 'iphone-ipad', 'android-phone-tablet', 'embedded'];

test('major device classes have at least one federation candidate', () => {
  for (const deviceClass of majorDevices) {
    assert.ok(listProtocolsForDevice(deviceClass).length > 0, deviceClass);
  }
});

test('resolution negotiation never exceeds probed source or sink capability', () => {
  assert.deepEqual(
    negotiateResolution({ sourceWidth: 24000, sourceHeight: 13500, sinkWidth: 7680, sinkHeight: 4320, requestedWidth: 24000, requestedHeight: 13500 }),
    { allowed: true, negotiatedWidth: 7680, negotiatedHeight: 4320, derivedFromHigherRequest: true },
  );
});

test('missing capability probe fails closed', () => {
  assert.deepEqual(
    negotiateResolution({ sourceWidth: 7680, sourceHeight: 4320, sinkWidth: null, sinkHeight: null, requestedWidth: 7680, requestedHeight: 4320 }),
    { allowed: false, reason: 'missing-capability-probe' },
  );
});

test('native claims require explicit capability verification', () => {
  assert.deepEqual(
    validateNativeClaim({ width: 24000, height: 13500, nativeCapabilityVerified: false }),
    { allowed: false, reason: 'native-capability-not-verified' },
  );
  assert.deepEqual(
    validateNativeClaim({ width: 24000, height: 13500, nativeCapabilityVerified: true }),
    { allowed: true, reason: 'native-target-capability-verified' },
  );
});
