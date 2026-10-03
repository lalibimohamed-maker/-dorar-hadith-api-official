import test from "node:test";
import assert from "node:assert/strict";
import {
  getSearchArchitectureContract,
  listSearchCategories,
  normalizeSearchResult,
  normalizeHadithEvidence,
  normalizeRevelationLink,
  evaluateRecitationSync,
  evaluateLibraryAccess
} from "../src/search-architecture.js";

test("search architecture exposes exactly the requested twelve top-level categories", () => {
  assert.deepEqual(listSearchCategories().map((item) => item.id), [
    "quran","tafsir","tadabbur","hadith","musnads-sunan","sirah",
    "fiqh","usul-fiqh","maqasid","aqidah","biographies","library"
  ]);
});

test("search result preserves source, type, verification and bibliography", () => {
  const result = normalizeSearchResult({
    id: "x", type: "book", title: "كتاب", sourceId: "shamela", source: "https://shamela.ws",
    author: "المؤلف", edition: "الطبعة الثانية", page: 44, verification: "bibliographic-record", rights: "link-only"
  });
  assert.equal(result.domain, "library");
  assert.equal(result.sourceId, "shamela");
  assert.equal(result.sourceType, "book");
  assert.deepEqual(result.bibliographic, { author: "المؤلف", edition: "الطبعة الثانية", page: 44 });
  assert.equal(result.rightsState, "link-only");
});

test("hadith source identity and grading remain separate", () => {
  const result = normalizeHadithEvidence({
    id: "h1", book: "صحيح البخاري", chapter: "كتاب العلم", hadithNumber: 1,
    grade: "صحيح", grader: "ناقد موثق", url: "https://example.org/h1" }) ;
  assert.equal(result.domain, "hadith");
  assert.equal(result.sourceEvidence.collection, "صحيح البخاري");
  assert.equal(result.gradingEvidence.value, "صحيح");
  assert.equal(result.gradingEvidence.reportedBy, "ناقد موثق");
  assert.equal(result.policy.collectionDoesNotCertifyAuthenticity, true);
});

test("unreported hadith grading is not inferred", () => {
  const result = normalizeHadithEvidence({ book: "مسند" });
  assert.equal(result.gradingEvidence.value, null);
  assert.equal(result.gradingEvidence.status, "not-reported");
});

test("revelation cause requires verified source and thematic similarity cannot promote it", () => {
  assert.equal(normalizeRevelationLink({ type: "revelation-cause", confidence: "candidate" }).promotionState, "candidate-cause");
  assert.equal(normalizeRevelationLink({ type: "revelation-cause", confidence: "verified" }).promotionState, "verified-cause");
  assert.equal(normalizeRevelationLink({ type: "inference", confidence: "verified" }).promotionState, "context-or-related");
});

test("maqasid contract contains the parent and five daruriyyat", () => {
  const c = getSearchArchitectureContract();
  assert.equal(c.maqasid.parent.id, "maqasid");
  assert.deepEqual(c.maqasid.daruriyyat.map((x) => x.id), ["din","nafs","aql","nasl","mal"]);
});

test("library PDF and DOCX access is rights-gated", () => {
  assert.equal(evaluateLibraryAccess({ format: "pdf", rightsStatus: "rights-unclear" }).canDownload, false);
  assert.equal(evaluateLibraryAccess({ format: "docx", rightsStatus: "licensed" }).canRedistribute, true);
  assert.equal(evaluateLibraryAccess({ format: "pdf", rightsStatus: "rights-unclear" }).fallback, "source-link-only");
});

test("recitation word sync requires both rights and trusted word timing", () => {
  assert.equal(evaluateRecitationSync({ rightsVerified: false, wordTimings: [1,2], ayahTiming: true }).mode, "ayah");
  assert.equal(evaluateRecitationSync({ rightsVerified: true, wordTimings: [], ayahTiming: true }).mode, "ayah");
  assert.equal(evaluateRecitationSync({ rightsVerified: true, wordTimings: [1,2], ayahTiming: true }).mode, "word");
  assert.equal(evaluateRecitationSync({ rightsVerified: false, wordTimings: [1], ayahTiming: false }).downloadAllowed, false);
});
