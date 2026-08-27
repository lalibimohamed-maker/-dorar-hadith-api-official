import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const registry = JSON.parse(
  fs.readFileSync(new URL('../config/free-first-fallback-registry-2026.json', import.meta.url), 'utf8')
);

test('free-first fallback registry requires non-paid baseline operation', () => {
  assert.equal(registry.principles.freeFirst, true);
  assert.equal(registry.principles.noPaidDependencyRequired, true);
  assert.equal(registry.principles.automaticScholarlyPromotionForbidden, true);
});

test('security capabilities fail closed when no equivalent fallback exists', () => {
  assert.equal(registry.domains.secrets.minimum, 'fail_closed_if_no_equivalent_free_engine_is_available');
  assert.equal(registry.domains.javascript_dependencies.minimum, 'fail_closed');
});

test('fallback policy restores the preferred engine when it becomes healthy', () => {
  assert.equal(registry.runtimeRules.recheckPrimaryOnEveryScheduledCycle, true);
  assert.equal(registry.runtimeRules.restorePrimaryWhenHealthy, true);
  assert.equal(registry.runtimeRules.recordFallbackEvent, true);
});

test('scientific promotion cannot be triggered merely by fallback success', () => {
  assert.equal(registry.principles.neverSilentlyLowerScientificAssurance, true);
  assert.equal(registry.principles.automaticScholarlyPromotionForbidden, true);
});
