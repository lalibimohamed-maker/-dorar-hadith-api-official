import assert from "node:assert/strict";
import test from "node:test";
import {
  applyEvidenceHardGate,
  buildGroundedGenerationContext,
  runOmegaEvidenceContract
} from "../src/omega-evidence-runtime.js";

const base = {
  evidence_id: "h:1",
  type: "hadith",
  source: "sahih-bukhari",
  document_id: "bukhari:1",
  language: "ar",
  rights_status: "cleared",
  provenance: "verified",
  sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  verification_status: "verified",
  authenticity_status: "sahih"
};

test("hard gate rejects a highly similar mawdu hadith before reranking", () => {
  let rerankerCalled = false;
  const candidates = [{ ...base, evidence_id: "bad:1", authenticity_status: "mawdu" }];
  const gated = applyEvidenceHardGate(candidates);
  assert.equal(gated.accepted.length, 0);
  assert.equal(gated.rejected.length, 1);
  assert.equal(gated.rejected[0].decision.eligible, false);

  const result = runOmegaEvidenceContract({
    candidates,
    reranker: () => {
      rerankerCalled = true;
      return candidates;
    },
    claims: [{ evidence_id: "bad:1" }]
  });
  assert.equal(result.code, "NO_EVIDENCE");
  assert.equal(rerankerCalled, false);
});

test("unknown provenance, rights, verification, source, or hash cannot reach reranking", () => {
  const candidate = {
    ...base,
    rights_status: "unknown",
    provenance: "unverified",
    verification_status: "pending",
    source: "",
    sha256: ""
  };
  const gated = applyEvidenceHardGate([candidate]);
  assert.equal(gated.accepted.length, 0);
  assert.deepEqual(gated.rejected[0].decision.reasons, [
    "missing_source",
    "missing_sha256",
    "rights_unknown_or_blocked",
    "provenance_missing_or_unverified",
    "verification_not_approved"
  ]);
});

test("weak hadith cannot satisfy a sound-evidence contract", () => {
  const result = runOmegaEvidenceContract({
    candidates: [{ ...base, authenticity_status: "weak" }],
    reranker: (items) => items,
    claims: [{ evidence_id: "h:1" }]
  });
  assert.equal(result.code, "NO_EVIDENCE");
});

test("reranker receives only hard-gated evidence", () => {
  const accepted = { ...base, evidence_id: "good:1" };
  const rejected = { ...base, evidence_id: "bad:1", authenticity_status: "very_weak" };
  let received = [];
  const result = runOmegaEvidenceContract({
    candidates: [rejected, accepted],
    reranker: (items) => {
      received = items;
      return items;
    },
    claims: [{ evidence_id: "good:1" }]
  });
  assert.equal(result.ok, true);
  assert.deepEqual(received.map((x) => x.evidence_id), ["good:1"]);
});

test("final grounded gate returns NO_EVIDENCE when a generated claim lacks evidence_id", () => {
  const evidence = [{ ...base, evidence_id: "good:1" }];
  const result = buildGroundedGenerationContext(evidence, [{ claim: "قول بلا تخريج" }]);
  assert.equal(result.ok, false);
  assert.equal(result.code, "NO_EVIDENCE");
  assert.deepEqual(result.missingClaimIndexes, [0]);
});

test("final grounded gate accepts only claims linked to returned evidence", () => {
  const evidence = [{ ...base, evidence_id: "good:1" }];
  const result = buildGroundedGenerationContext(evidence, [{ claim: "نص موثق", evidence_id: "good:1" }]);
  assert.equal(result.ok, true);
  assert.equal(result.code, "EVIDENCE_READY");
});

test("schema-shaped provenance can satisfy the hard gate", () => {
  const schemaShaped = {
    ...base,
    source: undefined,
    document_id: undefined,
    provenance: { source: "sahih-bukhari", document_id: "bukhari:1" },
    sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  };
  const decision = applyEvidenceHardGate([schemaShaped]);
  assert.equal(decision.accepted.length, 1);
  assert.equal(decision.rejected.length, 0);
});
