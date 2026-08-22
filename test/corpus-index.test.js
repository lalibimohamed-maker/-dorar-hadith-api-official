import test from "node:test";
import assert from "node:assert/strict";
import { buildCorpusIndex, normalizeQuery, searchCorpus, verifyRecord } from "../src/corpus-index.js";
import { buildResearchPacket, encyclopediaSearch } from "../src/encyclopedia-api-adapter.js";

const records = [
  { recordId: "x1", sourceId: "bukhari", sourceType: "book", titleOriginal: "صحيح البخاري", textOriginal: "كتاب العلم", reviewStatus: "source-verified", citation: { hadithNumber: 1 }, provenance: { sourceUrl: "https://example.invalid", editionOrRevision: "test" }, rights: "link-only" },
  { recordId: "x2", sourceId: "fatwa", sourceType: "fatwa", titleOriginal: "فتوى اختبار", textOriginal: "الصلاة", reviewStatus: "ingested" }
];

test("Arabic normalization is stable", () => { assert.equal(normalizeQuery("إِنَّ العِلْمَ"), "ان العلم"); });
test("index and search rank title and return source records", () => { assert.equal(buildCorpusIndex(records).length, 2); const results = searchCorpus("صحيح البخاري", {}, records); assert.equal(results[0].recordId, "x1"); });
test("verifiedOnly excludes unverified records", () => { const results = searchCorpus("الصلاة", { verifiedOnly: true }, records); assert.equal(results.length, 0); });
test("verification requires provenance, citation and review", () => { assert.equal(verifyRecord(records[0]).verified, true); assert.equal(verifyRecord(records[1]).verified, false); });
test("API adapter produces a research packet", () => {
  const params = { query: "العلم", language: "ar", verifiedOnly: true, records };
  const response = encyclopediaSearch(params);
  assert.equal(response.count, 1);
  const packet = buildResearchPacket(params);
  assert.equal(packet.verificationSummary.verifiedCount, 1);
});
