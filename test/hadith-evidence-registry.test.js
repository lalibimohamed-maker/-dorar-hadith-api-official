import assert from "node:assert/strict";
import test from "node:test";
import { getHadithEvidenceRegistry, searchHadithEvidence, canPresentAsVerifiedEvidence } from "../src/hadith-evidence-registry.js";

test("hadith evidence registry loads and has required policy", () => {
  const registry = getHadithEvidenceRegistry();
  assert.equal(registry.status, "verified-structure");
  assert.ok(Array.isArray(registry.records));
  assert.match(registry.policy, /لا يُعرض الحديث/);
});

test("paradise evidence is decomposed into research subtopics", () => {
  const records = searchHadithEvidence("paradise");
  assert.ok(records.some((r) => r.subtopic === "highest_degree"));
  assert.ok(records.some((r) => r.subtopic === "doors"));
  assert.ok(records.some((r) => r.subtopic === "rivers"));
});

test("unverified records cannot be presented as verified evidence", () => {
  const records = searchHadithEvidence("mahdi", "mahdi");
  assert.equal(records.length, 1);
  assert.equal(canPresentAsVerifiedEvidence(records[0]), false);
});
