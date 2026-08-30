import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ladder = JSON.parse(fs.readFileSync('config/media-quality-ladder-2026.json', 'utf8'));

test('quality ladder is open-ended', () => {
  assert.equal(ladder.master.maxResolution, null);
  assert.equal(ladder.master.applicationCeiling, null);
  assert.equal(ladder.futureTiersAllowed, true);
  for (const tier of ['24K', '16K', '12K', '8K', '4K']) assert.ok(ladder.downloadTiers.includes(tier), tier);
});

test('native and derived outputs remain distinct', () => {
  assert.equal(ladder.nativeVsDerived.nativeRequiresVerifiedSourceGeometry, true);
  assert.equal(ladder.nativeVsDerived.derivedMustBeLabeledDerived, true);
  assert.equal(ladder.nativeVsDerived.neverEquateUpscaleWithNative, true);
});
