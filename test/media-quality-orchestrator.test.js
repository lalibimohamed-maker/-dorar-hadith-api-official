import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMediaConfig, selectImageProfile, validateTargetDimensions } from '../src/media/media-quality-orchestrator.mjs';

test('media profiles define explicit high-resolution targets without claiming installation', () => {
  const config = loadMediaConfig();
  assert.equal(config.profiles['8k'].maxLongEdge, 7680);
  assert.equal(config.profiles['12k'].maxLongEdge, 11520);
  assert.equal(config.image.status, 'runtime-candidate-until-executable-and-model-evidence-exists');
  assert.equal(config.video.status, 'runtime-candidate-until-executable-and-gpu-evidence-exists');
});

test('profile scale is derived from the input image instead of inventing detail claims', () => {
  assert.deepEqual(selectImageProfile(1920, 1080, '8k'), {
    requested: '8k',
    maxLongEdge: 7680,
    scale: 4
  });
});

test('invalid or unknown profiles fail closed', () => {
  assert.throws(() => selectImageProfile(0, 1080, '8k'), /Invalid input dimensions/);
  assert.throws(() => selectImageProfile(1920, 1080, 'unknown'), /Unknown media profile/);
});

test('input larger than a requested cap is not silently downscaled by the super-resolution profile', () => {
  const result = validateTargetDimensions(15360, 8640, '12k');
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'input-already-exceeds-profile');
});
