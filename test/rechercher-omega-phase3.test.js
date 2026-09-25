import test from "node:test";
import assert from "node:assert/strict";
import { createCouncilCase, submitCouncilReview, finalizeCouncil } from "../src/rechercher-omega-council.js";
import { verifyWeightArtifact } from "../src/rechercher-omega-weight-verifier.js";
import { assertRuntimeGate } from "../src/rechercher-omega-runtime-gate.js";

test("Council remains blocked until independent quorum exists", () => {
  let c = createCouncilCase({ task: "scholarly_answer", evidence: ["src-1"] });
  c = submitCouncilReview(c, { role: "researcher", status: "pass" });
  assert.equal(finalizeCouncil(c).status, "blocked");
});

test("Council blocks on a blocking review", () => {
  let c = createCouncilCase({ task: "scholarly_answer", evidence: ["src-1"] });
  for (const role of ["researcher","source_auditor","contrarian","logic_auditor","media_critic"]) {
    c = submitCouncilReview(c, { role, status: role === "contrarian" ? "block" : "pass" });
  }
  assert.equal(finalizeCouncil(c).status, "blocked");
});

test("Weight promotion is blocked until SHA and license are verified", async () => {
  const result = await verifyWeightArtifact({
    manifestEntry: { model_id: "test", sha256: null, weight_license_status: "review_required" },
    path: "/definitely/missing"
  });
  assert.equal(result.status, "blocked");
});

test("Runtime gate never permits paid fallback or Corpus writes", () => {
  assert.doesNotThrow(() => assertRuntimeGate({
    paid_fallback_allowed: false,
    quota_exhaustion_action: "queue",
    corpus_write_allowed: false
  }));
});
