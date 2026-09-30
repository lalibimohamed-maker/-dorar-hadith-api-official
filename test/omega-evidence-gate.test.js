import assert from "node:assert/strict";
import test from "node:test";
import { applyEvidenceHardGate, runVerifiedRetrievalPipeline } from "../src/omega-evidence-gate.js";

const base = {
  evidence_id: "fixture:hadith:1",
  kind: "hadith",
  source: "fixture-hadith-source",
  document_id: "fixture-doc-1",
  sha256: "a".repeat(64),
  rights_status: "link-only",
  provenance: { status: "verified", citation: "fixture:1" },
  verification_status: "verified",
  authenticity_status: "sahih",
  grader: "fixture-grader",
  grading_source: "fixture-grading-source"
};

test("موضوع عالي التشابه يُرفض قبل استدعاء الـReranker", () => {
  const fabricatedMawdu = {
    ...base,
    evidence_id: "fixture:hadith:mawdu-high-similarity",
    text: "نص تجريبي موضوع مصمم ليتطابق دلاليًا مع السؤال؛ ليس حديثًا حقيقيًا.",
    authenticity_status: "mawdu",
    similarity: 0.9999
  };

  let rerankerCalls = 0;
  const result = runVerifiedRetrievalPipeline({
    candidates: [fabricatedMawdu],
    reranker(items) {
      rerankerCalls += 1;
      assert.deepEqual(items, [], "الموضوع يجب ألا يصل إلى الـReranker");
      return items;
    }
  });

  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].evidence_id, fabricatedMawdu.evidence_id);
  assert.equal(result.rejected[0].reason, "hadith_authenticity_not_eligible");
  assert.equal(result.rerankerInputIds.length, 0);
  assert.equal(rerankerCalls, 1);
});

test("التشابه لا يستطيع إنقاذ حديث موضوع من الـHard Gate", () => {
  const candidates = [
    {
      ...base,
      evidence_id: "fixture:hadith:mawdu-1",
      authenticity_status: "mawdu",
      similarity: 1.0
    },
    {
      ...base,
      evidence_id: "fixture:hadith:sahih-1",
      authenticity_status: "sahih",
      similarity: 0.71
    }
  ];

  let received;
  const result = runVerifiedRetrievalPipeline({
    candidates,
    reranker(items) {
      received = items;
      return [...items].sort((a, b) => b.similarity - a.similarity);
    }
  });

  assert.deepEqual(received.map((x) => x.evidence_id), ["fixture:hadith:sahih-1"]);
  assert.equal(result.rejected[0].evidence_id, "fixture:hadith:mawdu-1");
  assert.equal(result.reranked[0].evidence_id, "fixture:hadith:sahih-1");
});

test("حديث ذو حالة تحقق مجهولة يُرفض ولو كان التشابه 100%", () => {
  const result = applyEvidenceHardGate([{
    ...base,
    evidence_id: "fixture:hadith:unknown",
    verification_status: "unknown",
    similarity: 1.0
  }]);

  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected[0].reason, "verification_not_approved");
});

test("حديث بلا توثيق مصدر/درجة لا يصل إلى الـReranker", () => {
  const result = applyEvidenceHardGate([{
    ...base,
    evidence_id: "fixture:hadith:unattributed",
    grader: "",
    grading_source: ""
  }]);

  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected[0].reason, "hadith_grade_not_attributed");
});

test("الدليل الصحيح الموثق يمر إلى الـReranker", () => {
  const result = runVerifiedRetrievalPipeline({
    candidates: [{ ...base, evidence_id: "fixture:hadith:sahih-pass", similarity: 0.82 }],
    reranker(items) { return items; }
  });

  assert.deepEqual(result.rerankerInputIds, ["fixture:hadith:sahih-pass"]);
  assert.equal(result.rejected.length, 0);
});
