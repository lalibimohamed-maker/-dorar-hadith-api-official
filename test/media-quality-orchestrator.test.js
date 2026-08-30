import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMediaConfig, selectImageProfile, validateTargetDimensions } from '../src/media/media-quality-orchestrator.mjs';

test('high-resolution profiles are explicit without claiming engines are installed', () => {
  const config = loadMediaConfig();
  assert.equal(config.profiles['8k'].maxLongEdge, 7680);
  assert.equal(config.profiles['12k'].maxLongEdge, 11520);
  assert.equal(config.profiles['16k'].maxLongEdge, 15360);
  assert.equal(config.profiles['24k'].maxLongEdge, null);
  assert.equal(config.orchestration.noApplicationResolutionCeiling, true);
  assert.equal(config.orchestration.neverPresentUpscaleAsNative, true);
  assert.ok(config.engines.image.some((engine) => engine.name === 'Real-ESRGAN' && engine.status === 'candidate'));
  assert.ok(config.engines.video.some((engine) => engine.name === 'SeedVR2' && engine.status === 'candidate'));
  assert.ok(config.engines.video.some((engine) => engine.name === 'AVSR-Diff' && engine.status === 'candidate'));
});

test('8K scale is calculated from the real input dimensions', () => {
  assert.deepEqual(selectImageProfile(1920, 1080, '8k'), { requested: '8k', maxLongEdge: 7680, scale: 4 });
});

test('unknown profiles and invalid dimensions fail closed', () => {
  assert.throws(() => selectImageProfile(0, 1080, '8k'), /Invalid input dimensions/);
  assert.throws(() => selectImageProfile(1920, 1080, 'unknown'), /Unknown media profile/);
});

test('already larger input is never silently downscaled by a super-resolution profile', () => {
  const result = validateTargetDimensions(15360, 8640, '12k');
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'input-already-exceeds-profile');
});
