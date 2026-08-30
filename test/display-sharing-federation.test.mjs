import test from 'node:test';
import assert from 'node:assert/strict';
import { listProtocolsForDevice, negotiateResolution, validateNativeClaim } from '../src/media/display-sharing-federation.mjs';

const majorDevices = ['television', 'monitor', 'projector', 'computer', 'iphone-ipad', 'android-phone-tablet', 'embedded'];

test('major device classes have at least one federation candidate', () => {
  for (const deviceClass of majorDevices) {
    assert.ok(listProtocolsForDevice(deviceClass).length > 0, deviceClass);
  }
});

test('resolution negotiation never exceeds probed source or sink capability and preserves aspect ratio', () => {
  assert.deepEqual(
    negotiateResolution({ sourceWidth: 24000, sourceHeight: 13500, sinkWidth: 7680, sinkHeight: 4320, requestedWidth: 24000, requestedHeight: 13500 }),
    {
      allowed: true,
      negotiatedWidth: 7680,
      negotiatedHeight: 4320,
      aspectRatioPreserved: true,
      derivedFromHigherRequest: true,
    },
  );
});

test('resolution negotiation fits a mismatched request without distorting the source', () => {
  const result = negotiateResolution({
    sourceWidth: 3840,
    sourceHeight: 2160,
    sinkWidth: 2560,
    sinkHeight: 2160,
    requestedWidth: 2560,
    requestedHeight: 2160,
  });
  assert.equal(result.allowed, true);
  assert.equal(result.negotiatedWidth, 2560);
  assert.equal(result.negotiatedHeight, 1440);
  assert.equal(result.aspectRatioPreserved, true);
});

test('partial requested dimensions fail closed as invalid input', () => {
  assert.throws(
    () => negotiateResolution({
      sourceWidth: 3840,
      sourceHeight: 2160,
      sinkWidth: 2560,
      sinkHeight: 1440,
      requestedWidth: 2560,
    }),
    /Requested width and height must be supplied together/,
  );
});

test('missing capability probe fails closed', () => {
  assert.deepEqual(
    negotiateResolution({ sourceWidth: 7680, sourceHeight: 4320, sinkWidth: null, sinkHeight: null, requestedWidth: 7680, requestedHeight: 4320 }),
    { allowed: false, reason: 'missing-capability-probe' },
  );
});

test('native claims require exact target geometry evidence', () => {
  assert.deepEqual(
    validateNativeClaim({ width: 24000, height: 13500, nativeCapability: null }),
    { allowed: false, reason: 'native-capability-not-verified' },
  );
  assert.deepEqual(
    validateNativeClaim({ width: 24000, height: 13500, nativeCapability: { width: 7680, height: 4320 } }),
    { allowed: false, reason: 'native-geometry-mismatch' },
  );
  assert.deepEqual(
    validateNativeClaim({ width: 24000, height: 13500, nativeCapability: { width: 24000, height: 13500 } }),
    { allowed: true, reason: 'native-target-geometry-verified' },
  );
});
