import test from "node:test";
import assert from "node:assert/strict";
import { searchCorpus, verifyCitation, buildResearchPacket, normalize } from "../src/encyclopedia-search.js";

const records = [
  {
    recordId: "h-1", sourceId: "bukhari", sourceType: "hadith", language: "ar",
    titleOriginal: "حديث في العلم", textOriginal: "طلب العلم فريضة", keywords: ["علم", "حديث"],
    citation: { hadithNumber: "1" },
    provenance: { sourceUrl: "https://example.invalid/bukhari", editionOrRevision: "edition-1" },
    attribution: { authorOrScholar: "محمد بن إسماعيل البخاري" }, rights: "licensed", reviewStatus: "source-verified"
  },
  {
    recordId: "f-1", sourceId: "fiqh", sourceType: "fiqh", language: "ar",
    titleOriginal: "باب الصلاة", textOriginal: "أحكام الصلاة", keywords: ["صلاة", "فقه"],
    citation: { volumePage: "1/10" },
    provenance: { sourceUrl: "https://example.invalid/fiqh", editionOrRevision: "edition-1" },
    rights: "public-domain", reviewStatus: "published"
  }
];

test("Arabic normalization supports common orthographic variants", () => {
  assert.equal(normalize("إسلامٌ"), "اسلام");
});

test("search returns claimable source metadata without inventing citations", () => {
  const results = searchCorpus(records, "العلم", { verifiedOnly: true });
  assert.equal(results[0].recordId, "h-1");
  assert.equal(results[0].citation.hadithNumber, "1");
});

test("citation verification requires locator and provenance", () => {
  assert.equal(verifyCitation(records, "h-1").verified, true);
  assert.equal(verifyCitation(records, "missing").verified, false);
});

test("research packet reports verification counts", () => {
  const packet = buildResearchPacket(records, "الصلاة", { verifiedOnly: true, language: "ar" });
  assert.equal(packet.verificationSummary.verifiedCount, 1);
  assert.equal(packet.verificationSummary.unverifiedCount, 0);
});
