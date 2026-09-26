import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const registryPath = path.join(__dirname, "..", "config", "engine-evolution-2026.json");

function loadOmegaRegistry() {
  return JSON.parse(fs.readFileSync(registryPath, "utf8")).engines.omega_support;
}

function isHardEligible(evidence) {
  if (!evidence) return false;
  if (["unknown", "blocked"].includes(evidence.rights_status)) return false;
  if (!evidence.provenance || evidence.provenance.status !== "verified") return false;
  if (!["verified", "approved"].includes(evidence.verification_status)) return false;
  if (!evidence.source || !evidence.sha256) return false;
  return true;
}

function passesHadithGate(evidence) {
  if (!isHardEligible(evidence)) return false;
  if (evidence.type !== "hadith") return true;
  return !["mawdu", "batil", "very_weak", "unknown"].includes(evidence.authenticity_status);
}

function simulatePipeline(candidates, reranker) {
  const eligible = candidates.filter(passesHadithGate);
  const reranked = reranker(eligible);
  return { eligible, reranked };
}

test("Omega registry requires hard verification before semantic reranking", () => {
  const omega = loadOmegaRegistry();
  const stages = omega.executionPipeline.stages;

  assert.deepEqual(
    stages.map((stage) => stage.id),
    [
      "dense_retrieval",
      "evidence_eligibility_hard_gate",
      "semantic_reranking",
      "grounded_evidence_final_gate",
      "generation"
    ]
  );

  assert.equal(stages[1].hardFilter, true);
  assert.equal(stages[2].softFilterOnly, true);
  assert.equal(stages[2].input, "evidence.verified");
});

test("high-similarity fabricated/mawdu hadith is rejected before the reranker", () => {
  const rejected = {
    evidence_id: "TEST-MAWDU-HIGH-SIM",
    type: "hadith",
    text: "نص موضوع مصطنع صُمم ليطابق سؤال المستخدم دلاليًا بدرجة قصوى",
    semantic_similarity: 0.9999,
    source: "unapproved-test-source",
    sha256: "test-sha256-mawdu",
    rights_status: "cleared",
    provenance: { status: "verified" },
    verification_status: "approved",
    authenticity_status: "mawdu"
  };

  let rerankerCalls = 0;
  const result = simulatePipeline([rejected], (items) => {
    rerankerCalls += 1;
    return items;
  });

  assert.equal(result.eligible.length, 0);
  assert.equal(result.reranked.length, 0);
  assert.equal(rerankerCalls, 1);
  assert.deepEqual(result.reranked, []);
});

test("high-similarity very-weak and unknown-grade hadiths cannot bypass the hard gate", () => {
  const candidates = [
    {
      evidence_id: "TEST-VERY-WEAK",
      type: "hadith",
      semantic_similarity: 1,
      source: "approved-test-source",
      sha256: "sha-very-weak",
      rights_status: "cleared",
      provenance: { status: "verified" },
      verification_status: "verified",
      authenticity_status: "very_weak"
    },
    {
      evidence_id: "TEST-UNKNOWN-GRADE",
      type: "hadith",
      semantic_similarity: 1,
      source: "approved-test-source",
      sha256: "sha-unknown",
      rights_status: "cleared",
      provenance: { status: "verified" },
      verification_status: "verified",
      authenticity_status: "unknown"
    }
  ];

  let rerankerInput = null;
  const result = simulatePipeline(candidates, (items) => {
    rerankerInput = items;
    return items;
  });

  assert.equal(result.eligible.length, 0);
  assert.deepEqual(rerankerInput, []);
});

test("a verified hadith can reach the reranker while a more similar mawdu hadith cannot", () => {
  const candidates = [
    {
      evidence_id: "TEST-MAWDU-0.9999",
      type: "hadith",
      semantic_similarity: 0.9999,
      source: "approved-test-source",
      sha256: "sha-mawdu",
      rights_status: "cleared",
      provenance: { status: "verified" },
      verification_status: "verified",
      authenticity_status: "mawdu"
    },
    {
      evidence_id: "TEST-SAHIH-0.91",
      type: "hadith",
      semantic_similarity: 0.91,
      source: "approved-test-source",
      sha256: "sha-sahih",
      rights_status: "cleared",
      provenance: { status: "verified" },
      verification_status: "verified",
      authenticity_status: "sahih"
    }
  ];

  let rerankerInput = null;
  const result = simulatePipeline(candidates, (items) => {
    rerankerInput = items;
    return [...items].sort((a, b) => b.semantic_similarity - a.semantic_similarity);
  });

  assert.deepEqual(result.eligible.map((x) => x.evidence_id), ["TEST-SAHIH-0.91"]);
  assert.deepEqual(rerankerInput.map((x) => x.evidence_id), ["TEST-SAHIH-0.91"]);
  assert.equal(result.reranked[0].authenticity_status, "sahih");
  assert.equal(result.reranked.some((x) => x.authenticity_status === "mawdu"), false);
});

test("no eligible evidence produces the fail-closed NO_EVIDENCE contract", () => {
  const omega = loadOmegaRegistry();
  const finalGate = omega.executionPipeline.stages.find(
    (stage) => stage.id === "grounded_evidence_final_gate"
  );

  const result = simulatePipeline(
    [{
      evidence_id: "TEST-NO-EVIDENCE",
      type: "hadith",
      semantic_similarity: 0.99999,
      source: "unapproved",
      sha256: "sha-none",
      rights_status: "cleared",
      provenance: { status: "verified" },
      verification_status: "approved",
      authenticity_status: "mawdu"
    }],
    (items) => items
  );

  assert.equal(result.reranked.length, 0);
  assert.equal(finalGate.failClosed, true);
  assert.equal(finalGate.noEvidenceResponse, "NO_EVIDENCE");
});
