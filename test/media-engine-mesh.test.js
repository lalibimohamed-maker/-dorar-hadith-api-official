import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('media engine mesh is open-ended and evidence-gated', () => {
  const mesh = JSON.parse(fs.readFileSync('config/media-engine-mesh-2026.json', 'utf8'));
  assert.equal(mesh.targetQuality.masterResolution, null);
  assert.deepEqual(mesh.targetQuality.tiers, ['24K', '16K', '12K', '8K', '4K']);
  assert.equal(mesh.futureDiscovery.enabled, true);
  assert.equal(mesh.futureDiscovery.autoInstall, false);
  assert.equal(mesh.futureDiscovery.autoEnable, false);
  assert.equal(mesh.nativeVsDerived.neverLabelDerivedAsNative, true);
});

test('required current engine families are registered', () => {
  const mesh = JSON.parse(fs.readFileSync('config/media-engine-mesh-2026.json', 'utf8'));
  const names = mesh.registeredEngines.map((engine) => engine.name);
  for (const name of [
    'Real-ESRGAN', 'SwinIR', 'HAT', 'Video2X', 'BasicVSR++',
    'SeedVR2', 'FlashVSR', 'PS-SR', 'AVSR-Diff', 'Real-CUGAN',
    'RIFE', 'Anime4K', 'FFmpeg',
  ]) assert.ok(names.includes(name), `${name} must be registered`);
});

test('NanoCell is a display profile, not a video processing engine', () => {
  const mesh = JSON.parse(fs.readFileSync('config/media-engine-mesh-2026.json', 'utf8'));
  assert.equal(mesh.display.nanocell.processingRole, false);
  assert.equal(mesh.display.nanocell.true24KRequiresPhysicalDisplayValidation, true);
});

test('free-first remains mandatory', () => {
  const mesh = JSON.parse(fs.readFileSync('config/media-engine-mesh-2026.json', 'utf8'));
  assert.equal(mesh.freeFirst.paidApiRequired, false);
  assert.equal(mesh.freeFirst.subscriptionRequired, false);
});
