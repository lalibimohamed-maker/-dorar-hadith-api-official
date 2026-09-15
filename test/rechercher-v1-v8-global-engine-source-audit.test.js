import test from 'node:test';
import assert from 'node:assert/strict';
import audit from '../config/rechercher-v1-v8-global-engine-source-audit-2026.json' with { type: 'json' };

test('V1-V8 global audit has an engine, resources and tests for every stage', () => {
  const stages = Object.entries(audit.stages);
  assert.equal(stages.length, 8);
  for (const [stageId, stage] of stages) {
    assert.ok(stage.engine || stage.engines || stage.engine_families, `${stageId} missing engine declaration`);
    assert.ok(stage.resources, `${stageId} missing resource declaration`);
    assert.ok(Array.isArray(stage.tests) && stage.tests.length > 0, `${stageId} missing tests`);
    assert.match(stage.state, /^IMPLEMENTED_FOUNDATION$/);
  }
});

test('V1-V8 global audit preserves the non-negotiable safety boundaries', () => {
  assert.equal(audit.global_safety.rights_unknown_publishable, false);
  assert.equal(audit.global_safety.rights_restricted_publishable, false);
  assert.equal(audit.global_safety.explicit_permission_required, true);
  assert.equal(audit.global_safety.original_pdf_immutable, true);
  assert.equal(audit.global_safety.canonical_quran_arabic_immutable, true);
  assert.equal(audit.global_safety.ai_synthesis_authoritative, false);
  assert.equal(audit.global_safety.learning_can_override_religious_authority, false);
  assert.equal(audit.global_safety.acquisition_independent, true);
});

test('V1-V8 global audit does not falsely claim final promotion before CI is green', () => {
  assert.equal(audit.verification.promotion, 'BLOCKED_UNTIL_CI_GREEN');
  assert.equal(audit.verification.last_ci_result, 'FAIL_ONE_TEST');
});

test('global resource families are explicitly registered', () => {
  assert.ok(audit.global_resource_families.length >= 30);
  assert.ok(audit.global_resource_families.includes('OPENITI_KITAB'));
  assert.ok(audit.global_resource_families.includes('INTERNET_ARCHIVE'));
  assert.ok(audit.global_resource_families.includes('WAQFEYA'));
  assert.ok(audit.global_resource_families.includes('ISLAMQA_RU'));
});
