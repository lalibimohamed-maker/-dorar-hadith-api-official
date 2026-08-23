import assert from "node:assert/strict";
import test from "node:test";
import { normalizeQuery, searchCorpus } from "../src/corpus-index.js";

test("normalizes common Arabic spelling and diacritics", () => {
  assert.equal(normalizeQuery("إِنَّ الصَّلاةَ"), "ان الصلاه");
});

test("ranks an exact title above a token-only match", () => {
  const records = [
    { sourceId: "general", sourceType: "book", titleOriginal: "أحكام الصلاة", textOriginal: "الصلاة وأحكامها" },
    { sourceId: "prayer", sourceType: "book", titleOriginal: "الصلاة", textOriginal: "كتاب الصلاة" }
  ];
  const results = searchCorpus("الصلاة", {}, records);
  assert.equal(results[0].sourceId, "prayer");
});

test("uses scholar and institution metadata in relevance scoring", () => {
  const records = [
    { sourceId: "other", sourceType: "fatwa", titleOriginal: "فتوى", textOriginal: "أحكام متنوعة" },
    { sourceId: "target", sourceType: "fatwa", titleOriginal: "فتوى", textOriginal: "أحكام متنوعة", attribution: { authorOrScholar: "الشيخ عبد العزيز بن باز", institution: "الرئاسة العامة للبحوث العلمية والإفتاء" } }
  ];
  const results = searchCorpus("ابن باز", {}, records);
  assert.equal(results[0].sourceId, "target");
});

test("verified-only search excludes unverified records", () => {
  const records = [
    { sourceId: "pending", sourceType: "book", titleOriginal: "الصلاة", reviewStatus: "ingested" },
    { sourceId: "verified", sourceType: "book", titleOriginal: "الصلاة", reviewStatus: "source-verified", citation: "x", provenance: "y" }
  ];
  const results = searchCorpus("الصلاة", { verifiedOnly: true }, records);
  assert.deepEqual(results.map((record) => record.sourceId), ["verified"]);
});
