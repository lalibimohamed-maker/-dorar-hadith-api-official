import test from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
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


test("Acquisition manifest verifies every listed file before promotion", async () => {
  const dir = await mkdtemp(join(tmpdir(), "omega-weight-"));
  try {
    const payload = Buffer.from("omega-test-weight");
    const digest = createHash("sha256").update(payload).digest("hex");
    const manifest = {
      model_id: "test",
      revision: "immutable-test",
      manifest_sha256: createHash("sha256")
        .update("weights.bin=" + digest + "\n", "utf8")
        .digest("hex"),
      files: [{ path: "weights.bin", bytes: payload.length, sha256: digest }]
    };
    await writeFile(join(dir, "weights.bin"), payload);
    await writeFile(join(dir, "acquisition.json"), JSON.stringify(manifest));
    const { verifyWeightArtifact } = await import("../src/rechercher-omega-weight-verifier.js");
    const result = await verifyWeightArtifact({
      manifestEntry: {
        model_id: "test",
        weight_license_status: "cleared",
        verification: {
          mode: "acquisition_artifact_manifest",
          manifest_file: "acquisition.json",
          checksum_file: "SHA256SUMS"
        }
      },
      path: dir
    });
    assert.equal(result.status, "verified");
    assert.equal(result.files_verified, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
