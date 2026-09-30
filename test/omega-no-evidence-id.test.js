import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGroundedGenerationContext,
  runOmegaEvidenceContract
} from "../src/omega-evidence-runtime.js";

const evidence = {
  evidence_id: "hadith:verified:1",
  type: "hadith",
  source: "approved-hadith-source",
  document_id: "book:1",
  language: "ar",
  rights_status: "cleared",
  provenance: "verified",
  sha256: "sha-verified-1",
  verification_status: "verified",
  authenticity_status: "sahih"
};

test("claim without evidence_id becomes NO_EVIDENCE", () => {
  const result = buildGroundedGenerationContext([evidence], [
    { claim: "ادعاء موثق ظاهريًا" }
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.code, "NO_EVIDENCE");
  assert.deepEqual(result.missingClaimIndexes, [0]);
});

test("claim with null evidence_id becomes NO_EVIDENCE", () => {
  const result = buildGroundedGenerationContext([evidence], [
    { claim: "ادعاء", evidence_id: null }
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.code, "NO_EVIDENCE");
});

test("claim with empty evidence_id becomes NO_EVIDENCE", () => {
  const result = buildGroundedGenerationContext([evidence], [
    { claim: "ادعاء", evidence_id: "" }
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.code, "NO_EVIDENCE");
});

test("claim with unknown evidence_id becomes NO_EVIDENCE", () => {
  const result = buildGroundedGenerationContext([evidence], [
    { claim: "ادعاء", evidence_id: "hadith:does-not-exist" }
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.code, "NO_EVIDENCE");
  assert.deepEqual(result.missingClaimIndexes, [0]);
});

test("mixed claims fail closed if even one claim lacks a valid evidence_id", () => {
  const result = buildGroundedGenerationContext([evidence], [
    { claim: "ادعاء صحيح", evidence_id: evidence.evidence_id },
    { claim: "ادعاء بلا دليل" },
    { claim: "ادعاء بدليل مزور", evidence_id: "fake:evidence:999" }
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.code, "NO_EVIDENCE");
  assert.deepEqual(result.missingClaimIndexes, [1, 2]);
});

test("runtime contract refuses generation context when reranked evidence exists but claim has no evidence_id", () => {
  const result = runOmegaEvidenceContract({
    candidates: [evidence],
    reranker: (items) => items,
    claims: [{ claim: "إجابة بلا إحالة" }]
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "NO_EVIDENCE");
  assert.equal(result.evidence?.length ?? 0, 0);
  assert.equal(result.claims?.length ?? 0, 0);
});

test("all claims with valid evidence_ids produce EVIDENCE_READY", () => {
  const result = buildGroundedGenerationContext([evidence], [
    { claim: "ادعاء موثق", evidence_id: evidence.evidence_id }
  ]);

  assert.equal(result.ok, true);
  assert.equal(result.code, "EVIDENCE_READY");
});
