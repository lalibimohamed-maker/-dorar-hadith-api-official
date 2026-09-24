import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertTrustedSource,
  classifyEvidenceRole,
  crossReferenceStatus,
  circuitBreakerState,
  validateEvidenceRecord
} from '../scripts/rechercher_strict_evidence_pipeline.mjs';

test('accepts only HTTPS origins from the explicit allowlist', () => {
  const allowed = new Set(['https://trusted.example']);
  assert.deepEqual(assertTrustedSource({url:'https://trusted.example/item',allowedOrigins:allowed,sourceId:'trusted'}), {sourceId:'trusted',origin:'https://trusted.example'});
  assert.throws(() => assertTrustedSource({url:'http://trusted.example/item',allowedOrigins:allowed,sourceId:'trusted'}), /source_must_use_https/);
  assert.throws(() => assertTrustedSource({url:'https://other.example/item',allowedOrigins:allowed,sourceId:'trusted'}), /source_origin_not_allowlisted/);
});

test('keeps AI and unverified machine translation outside religious source roles', () => {
  assert.equal(classifyEvidenceRole({ai_generated:true}), 'machine_translation');
  assert.equal(classifyEvidenceRole({discovery_only:true}), 'discovery_only');
  assert.equal(classifyEvidenceRole({is_translation:true,human_verified:false}), 'discovery_only');
  assert.equal(classifyEvidenceRole({is_translation:true,human_verified:true}), 'human_translation');
});

test('cross-reference reports integrity agreement but always requires human review', () => {
  const result = crossReferenceStatus([{sourceId:'a',sha256:'x'},{sourceId:'b',sha256:'x'}]);
  assert.equal(result.agreement, true);
  assert.equal(result.requiresHumanReview, true);
});

test('circuit breaker freezes an adapter after the failure threshold', () => {
  assert.equal(circuitBreakerState({consecutiveFailures:3,threshold:3}).tripped, true);
  assert.equal(circuitBreakerState({consecutiveFailures:3,threshold:3}).action, 'freeze_adapter_and_route_to_review');
});

test('blocks promotion of discovery-only and machine-generated evidence', () => {
  assert.equal(validateEvidenceRecord({sourceId:'x',url:'https://x',provenance:'p',rightsStatus:'review',role:'discovery_only',promoteToCorpus:true}).valid, false);
  assert.equal(validateEvidenceRecord({sourceId:'x',url:'https://x',provenance:'p',rightsStatus:'review',role:'machine_translation',promoteToCorpus:true}).valid, false);
});
