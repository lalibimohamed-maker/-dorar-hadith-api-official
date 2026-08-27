import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const registryPath = path.join(root, 'config/media-tool-discovery-registry-2026.json');
const bootstrapPath = path.join(root, 'scripts/media/bootstrap-open-source-toolchain.sh');

test('media registry remains fail-closed for automatic software adoption', () => {
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  assert.equal(registry.policy.discoverAutomatically, true);
  assert.equal(registry.policy.installAutomatically, false);
  assert.equal(registry.policy.promoteAutomatically, false);
  assert.equal(registry.policy.requireProtectedPRForUpdates, true);
  assert.equal(registry.policy.futureReleaseIsNotAutomaticallyFreeForever, true);
});

test('bootstrap does not download models or execute arbitrary URLs', () => {
  const script = fs.readFileSync(bootstrapPath, 'utf8');
  assert.match(script, /MEDIA_TOOLCHAIN_INSTALL/);
  assert.doesNotMatch(script, /curl\s+[^\n]*\|\s*(sh|bash)/);
  assert.doesNotMatch(script, /wget\s+[^\n]*\|\s*(sh|bash)/);
  assert.match(script, /does not .*download model weights/i);
});

test('high-resolution and immersion are represented as capabilities, not unsupported claims', () => {
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const ids = new Set(registry.capabilities.map((entry) => entry.id));
  assert.equal(ids.has('image-super-resolution'), true);
  assert.equal(ids.has('video-upscaling'), true);
  assert.equal(ids.has('3d-interchange'), true);
  assert.equal(ids.has('3d-reconstruction'), true);
  assert.equal(ids.has('immersive-media'), true);
});
