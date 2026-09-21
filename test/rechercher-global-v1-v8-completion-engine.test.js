import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertGlobalCompletion,
  createGlobalCompletionSnapshot,
  createGlobalSourceRecord,
  evaluateGlobalSourceRegistry,
} from '../src/rechercher-global-v1-v8-completion-engine.js';

test('source registry preserves identity, provenance and rights gates', () => {
  const record = createGlobalSourceRecord({
    sourceId: 'openiti',
    name: 'OpenITI / KITAB',
    sourceType: 'DIGITAL_REPOSITORY',
    accessMode: 'API_OR_REPOSITORY',
    adapterStatus: 'READY',
    rightsStatus: 'ALLOWED',
    provenance: { registry: 'rechercher', checkedBy: 'test' },
  });
  assert.equal(record.sourceId, 'openiti');
  assert.equal(record.rightsStatus, 'ALLOWED');
  assert.ok(record.provenance);
});

test('unknown and restricted rights cannot become acquisition-ready', () => {
  const result = evaluateGlobalSourceRegistry([
    { sourceId: 'a', adapterStatus: 'READY', rightsStatus: 'ALLOWED', provenance: { id: 'a' } },
    { sourceId: 'b', adapterStatus: 'READY', rightsStatus: 'UNKNOWN', provenance: { id: 'b' } },
    { sourceId: 'c', adapterStatus: 'READY', rightsStatus: 'RESTRICTED', provenance: { id: 'c' } },
  ]);
  assert.equal(result.readySourceCount, 1);
  assert.equal(result.rightsBlockedCount, 2);
  assert.equal(result.gates.rights, false);
});

test('completion gate refuses a false V1-V8 complete state', () => {
  const result = createGlobalCompletionSnapshot({
    coverage: {
      discovery: 'IMPLEMENTED', identity: 'IMPLEMENTED', provenance: 'IMPLEMENTED', rights: 'IMPLEMENTED', evidence: 'IMPLEMENTED',
    },
    evidence: { unit_tests: true, integration_tests: true },
  });
  assert.equal(result.complete, false);
  assert.throws(() => assertGlobalCompletion(result), /completion gate blocked/);
});

test('completion gate can prove complete only when every required capability and gate passes', () => {
  const coverage = {};
  for (const stage of [
    'discovery','identity','provenance','rights','evidence','source_federation','multilingual_alignment','adaptive_scheduling','manifests','reproducibility',
    'quran','hadith','fiqh','tafsir','sirah','arabic','cognitive_diagnosis','retrieval','feedback','transfer','teach_back','metacognition',
    'global_discovery','research_trace','manuscript_readiness','edition_readiness','multimodal_alignment','source_registry','identity_deduplication','rights_evaluation','provenance_validation','edition_manifest_linking',
    'claims','evidence','contradictions','scholar_review','attribution_graph','scholar_graph','hadith_chain_graph','fiqh_disagreement_graph','multilingual_evidence_graph',
    'learner_state','prerequisite_diagnosis','misconception_detection','source_selection','adaptive_difficulty','retrieval_loop','transfer','mastery','spaced_review',
  ]) coverage[stage] = 'IMPLEMENTED';
  const evidence = Object.fromEntries([
    'unit_tests','integration_tests','full_ci','security_gates','governance_gates','rights_gate','provenance_gate','immutability_gate','ai_review_gate','continuous_evolution_gate',
  ].map(key => [key, true]));
  const result = createGlobalCompletionSnapshot({ coverage, evidence });
  assert.equal(result.complete, true);
  assert.equal(result.state, 'GLOBAL_OPERATIONAL_COMPLETE');
  assert.equal(assertGlobalCompletion(result), true);
});
