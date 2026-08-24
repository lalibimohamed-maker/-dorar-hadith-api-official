import test from "node:test";
import assert from "node:assert/strict";
import { buildBookDeliveryPolicy, QURAN_POLICY } from "../src/universal-reader-policy.js";

test("redistributable book gets the digital master in the requested language", () => {
  const result = buildBookDeliveryPolicy({ rights: { status: "public-domain" }, language: { browserLanguage: "fr" } });
  assert.equal(result.language, "fr");
  assert.equal(result.canRead, true);
  assert.equal(result.canCopyText, true);
  assert.equal(result.canDownloadDigitalMaster, true);
  assert.equal(result.mode, "digital-master");
});

test("copyrighted reader-only book stays online but may allow copy when the source permits it", () => {
  const result = buildBookDeliveryPolicy({
    rights: { status: "read-only" },
    sourceAllowsReading: true,
    sourceAllowsCopy: true,
    language: { browserLanguage: "en" }
  });
  assert.equal(result.language, "en");
  assert.equal(result.canRead, true);
  assert.equal(result.canCopyText, true);
  assert.equal(result.canDownloadDigitalMaster, false);
  assert.equal(result.mode, "reader-only");
});

test("unknown rights do not create a download permission", () => {
  const result = buildBookDeliveryPolicy({ rights: { status: "unknown" }, language: { browserLanguage: "fr" } });
  assert.equal(result.canDownloadDigitalMaster, false);
  assert.equal(result.canRead, false);
  assert.equal(result.mode, "source-link");
});

test("requested language overrides browser language", () => {
  const result = buildBookDeliveryPolicy({ rights: { status: "public-domain" }, language: { browserLanguage: "fr", requestedLanguage: "en" } });
  assert.equal(result.language, "en");
});

test("Quran Arabic remains canonical while meaning translation is presented below it", () => {
  assert.equal(QURAN_POLICY.arabicText, "canonical-arabic-source");
  assert.equal(QURAN_POLICY.neverReplaceArabicWithTranslation, true);
  assert.equal(QURAN_POLICY.translationMode, "meaning-translation-below-arabic");
});
