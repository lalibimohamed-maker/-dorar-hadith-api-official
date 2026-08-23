import assert from "node:assert/strict";
import test from "node:test";
import { buildProvenance, getCorpusProvenancePolicy, isVerifiedState, summarizeCorpusProvenance, validateCorpusRecord } from "../src/corpus-provenance.js";

test("provenance policy defines the corpus source contract", () => {
  const policy = getCorpusProvenancePolicy();
  assert.ok(policy.requiredFields.includes("sourceId"));
  assert.ok(policy.sourceTypes.includes("hadith"));
  assert.ok(policy.verificationStates.includes("scholar_reviewed"));
  assert.ok(policy.verificationStates.includes("pending_verification"));
});

test("pending records are never trusted", () => {
  for (const verificationState of ["pending_review", "pending_verification"]) {
    const result = validateCorpusRecord({
      recordId: "hadith:1",
      sourceId: "bukhari",
      sourceType: "hadith",
      verificationState,
      attribution: { authorOrScholar: "محمد بن إسماعيل البخاري" }
    });
    assert.equal(result.valid, true);
    assert.equal(result.trusted, false);
    assert.equal(isVerifiedState(verificationState), false);
  }
});

test("verified states are explicitly trusted", () => {
  assert.equal(isVerifiedState("source_verified"), true);
  assert.equal(isVerifiedState("edition_verified"), true);
  assert.equal(isVerifiedState("scholar_reviewed"), true);
  assert.equal(isVerifiedState("ingested"), false);
});

test("provenance requires source identity and attribution", () => {
  assert.throws(() => buildProvenance({ recordId: "x", sourceType: "hadith" }), /Invalid corpus provenance/);
  const provenance = buildProvenance({
    recordId: "hadith:1",
    sourceId: "bukhari",
    sourceType: "hadith",
    verificationState: "source_verified",
    attribution: { authorOrScholar: "محمد بن إسماعيل البخاري" },
    citation: { book: "صحيح البخاري", reference: "1" }
  });
  assert.equal(provenance.trusted, true);
});

test("summary distinguishes trusted, pending and invalid records", () => {
  const summary = summarizeCorpusProvenance([
    { recordId: "1", sourceId: "quran", sourceType: "quran", verificationState: "source_verified", attribution: {} },
    { recordId: "2", sourceId: "bukhari", sourceType: "hadith", verificationState: "pending_review", attribution: {} },
    { recordId: "3", sourceId: "bukhari", sourceType: "hadith", verificationState: "pending_verification", attribution: {} },
    { recordId: "4", sourceType: "hadith", verificationState: "pending_review", attribution: {} }
  ]);
  assert.equal(summary.trusted, 1);
  assert.equal(summary.pending, 2);
  assert.equal(summary.invalid, 1);
});
