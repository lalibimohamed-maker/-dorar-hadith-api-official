import assert from "node:assert/strict";
import test from "node:test";
import { runOmegaEvidenceContract } from "../src/omega-evidence-runtime.js";

const verifiedSahih = {
  evidence_id: "hadith:sahih:1",
  type: "hadith",
  source: "approved-hadith-source",
  document_id: "hadith-book:1",
  language: "ar",
  rights_status: "cleared",
  provenance: "verified",
  sha256: "sha-sahih-1",
  verification_status: "verified",
  authenticity_status: "sahih"
};

function adversarialCandidate(authenticity_status) {
  return {
    ...verifiedSahih,
    evidence_id: `adversarial:${authenticity_status}`,
    document_id: `adversarial-book:${authenticity_status}`,
    sha256: `sha-${authenticity_status}`,
    authenticity_status,
    semanticSimilarity: 1.0,
    text: "نص تجريبي مطابق دلاليًا للسؤال لكنه غير مؤهل كدليل صحيح."
  };
}

for (const status of ["mawdu", "batil", "very_weak"]) {
  test(`adversarial: ${status} at 100% semantic similarity is rejected before reranking`, () => {
    let rerankerCalled = false;
    let rerankerInput = null;

    const result = runOmegaEvidenceContract({
      candidates: [adversarialCandidate(status)],
      reranker: (items) => {
        rerankerCalled = true;
        rerankerInput = items;
        return items;
      },
      claims: [{ evidence_id: `adversarial:${status}` }]
    });

    assert.equal(result.code, "NO_EVIDENCE");
    assert.equal(result.ok, false);
    assert.equal(rerankerCalled, false);
    assert.equal(rerankerInput, null);
    assert.equal(result.rejected.length, 1);
    assert.ok(result.rejected[0].decision.reasons.includes("hadith_authenticity_rejected"));
  });
}

test("adversarial mawdu result cannot outrank or contaminate a valid sahih result", () => {
  const bad = adversarialCandidate("mawdu");
  const good = { ...verifiedSahih, semanticSimilarity: 0.72 };
  let rerankerInput = [];

  const result = runOmegaEvidenceContract({
    candidates: [bad, good],
    reranker: (items) => {
      rerankerInput = items;
      return [...items].sort((a, b) => b.semanticSimilarity - a.semanticSimilarity);
    },
    claims: [{ evidence_id: good.evidence_id }]
  });

  assert.equal(result.ok, true);
  assert.equal(result.code, "EVIDENCE_READY");
  assert.deepEqual(rerankerInput.map((x) => x.evidence_id), [good.evidence_id]);
  assert.ok(!result.reranked.some((x) => x.evidence_id === bad.evidence_id));
});

test("a 100%-similar mawdu candidate cannot cause NO_EVIDENCE when a valid candidate exists", () => {
  const bad = adversarialCandidate("mawdu");
  const good = { ...verifiedSahih, semanticSimilarity: 0.31 };

  const result = runOmegaEvidenceContract({
    candidates: [bad, good],
    reranker: (items) => items,
    claims: [{ evidence_id: good.evidence_id }]
  });

  assert.equal(result.ok, true);
  assert.equal(result.code, "EVIDENCE_READY");
  assert.equal(result.reranked.length, 1);
  assert.equal(result.reranked[0].evidence_id, good.evidence_id);
});
