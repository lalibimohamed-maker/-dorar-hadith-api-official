import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateProductionPlan,
  loadMediaProductionContract,
  makeDryRunProductionPlan
} from '../src/din-allah-media-production-cycle.js';

test('full media lifecycle is explicit and production-oriented', () => {
  const c = loadMediaProductionContract();
  assert.equal(c.principles.freeFirst, true);
  assert.equal(c.principles.noPaidCoreDependency, true);
  assert.equal(c.principles.corpusIsImmutable, true);
  assert.equal(c.lifecycle[0], 'intake');
  assert.equal(c.lifecycle.at(-1), 'rollback_and_rebuild');
  assert.ok(c.lifecycle.includes('rights_and_license_gate'));
  assert.ok(c.lifecycle.includes('provenance_manifest'));
  assert.ok(c.lifecycle.includes('publication_gate'));
});

test('Quran integrity remains a hard gate', () => {
  const c = loadMediaProductionContract();
  assert.equal(c.quranPolicy.arabicHandling, 'verbatim_only');
  assert.equal(c.quranPolicy.generatedArabicText, 'forbidden');
  assert.equal(c.quranPolicy.generatedQuranRecitation, 'forbidden');
});

test('complete dry-run production plan passes every gate', () => {
  const result = evaluateProductionPlan(makeDryRunProductionPlan());
  assert.equal(result.ok, true);
  assert.deepEqual(result.failed, []);
});

test('incomplete plan fails closed', () => {
  const result = evaluateProductionPlan({
    intake: {},
    brief: 'x',
    evidencePacket: {},
    claimVerificationStatus: 'verified',
    quranTextMode: 'generated',
    quranTextSource: 'unverified',
    generatedQuranText: true,
    generatedQuranRecitation: true
  });
  assert.equal(result.ok, false);
  assert.ok(result.failed.includes('rights_and_license_gate'));
  assert.ok(result.failed.includes('quran_integrity'));
  assert.ok(result.failed.includes('publication_gate'));
});

test('free toolchain has no mandatory proprietary service', () => {
  const c = loadMediaProductionContract();
  assert.equal(c.freeToolchain.core.some((x) => x.id === 'ffmpeg'), true);
  assert.equal(c.freeToolchain.core.some((x) => x.id === 'blender'), true);
  assert.equal(c.freeToolchain.core.some((x) => x.id === 'whisper'), true);
  assert.equal(c.principles.optionalPaidAdaptersMustBeNonBlocking, true);
});
