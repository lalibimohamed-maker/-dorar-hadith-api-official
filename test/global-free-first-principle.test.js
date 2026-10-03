import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const cfg = JSON.parse(fs.readFileSync(new URL('../config/global-free-first-principle-2026.json', import.meta.url), 'utf8'));

test('global free-first principle is normative', () => {
  assert.equal(cfg.rules.freeFirst, true);
  assert.equal(cfg.rules.noPaidSubscriptionRequired, true);
  assert.equal(cfg.rules.noPaidApiRequired, true);
  assert.equal(cfg.rules.noFeatureDroppedBecauseOfCost, true);
  assert.equal(cfg.rules.noSilentCapabilityDowngrade, true);
  assert.equal(cfg.rules.freeAlternativeMustBeSearchedBeforePaidDependency, true);
});

test('scientific assurance cannot be silently downgraded', () => {
  assert.equal(cfg.scientificPolicy.singleEngineCannotEstablishScholarlyTruth, true);
  assert.equal(cfg.scientificPolicy.sourceProvenanceRequired, true);
  assert.equal(cfg.scientificPolicy.uncertaintyPreserved, true);
  assert.equal(cfg.scientificPolicy.contradictionsRemainVisible, true);
});

test('book restoration preserves the original and allows a derived readable edition', () => {
  assert.equal(cfg.bookPolicy.preserveOriginal, true);
  assert.equal(cfg.bookPolicy.preserveDiplomaticText, true);
  assert.equal(cfg.bookPolicy.historicalRepairCannotSilentlyChangeContent, true);
  assert.equal(cfg.bookPolicy.readableDerivedEditionAllowed, true);
  assert.equal(cfg.bookPolicy.multiFormatExportAllowed, true);
});
