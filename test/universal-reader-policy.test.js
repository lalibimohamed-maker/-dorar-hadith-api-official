import test from "node:test";
import assert from "node:assert/strict";
import { buildBookDeliveryPolicy, buildQuranReadingRepresentation, normalizeSupportedFormats, QURAN_POLICY, READER_PIPELINE } from "../src/universal-reader-policy.js";

test("redistributable book gets the digital master in the requested language", () => {
  const result = buildBookDeliveryPolicy({
    rights: { status: "public-domain" },
    language: { browserLanguage: "fr" },
    provenanceVerified: true,
    validationPassed: true
  });
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


test("reader pipeline keeps discovery, edition, provenance, rights, validation and digital processing explicit", () => {
  const result = buildBookDeliveryPolicy({
    rights: { status: "licensed" },
    language: { browserLanguage: "fr" },
    provenanceVerified: true,
    validationPassed: true
  });
  assert.deepEqual(result.pipeline, [...READER_PIPELINE]);
  assert.equal(result.canDownloadDigitalMaster, true);
  assert.deepEqual(result.downloadableFormats, ["pdf", "docx", "epub"]);
  assert.equal(result.distinction, "Reading Representation != Redistribution Master");
});

test("read permission never becomes redistribution permission", () => {
  const result = buildBookDeliveryPolicy({
    rights: { status: "read-only" },
    sourceAllowsReading: true,
    sourceAllowsCopy: true,
    provenanceVerified: true,
    validationPassed: true
  });
  assert.equal(result.canRead, true);
  assert.equal(result.canCopyText, true);
  assert.equal(result.canDownloadDigitalMaster, false);
  assert.deepEqual(result.downloadableFormats, []);
  assert.equal(result.mode, "reader-only");
});

test("digital master waits for provenance and validation", () => {
  const missingProvenance = buildBookDeliveryPolicy({
    rights: { status: "public-domain" },
    provenanceVerified: false,
    validationPassed: true
  });
  const missingValidation = buildBookDeliveryPolicy({
    rights: { status: "public-domain" },
    provenanceVerified: true,
    validationPassed: false
  });
  assert.equal(missingProvenance.canDownloadDigitalMaster, false);
  assert.equal(missingValidation.canDownloadDigitalMaster, false);
});

test("Quran reading representation retains Arabic and separate translation metadata", () => {
  const result = buildQuranReadingRepresentation({
    arabicText: "الحمد لله رب العالمين",
    translation: "All praise is due to Allah, Lord of the worlds.",
    translationLanguage: "en",
    translationSource: "trusted-translation-1"
  });
  assert.equal(result.arabicText, "الحمد لله رب العالمين");
  assert.equal(result.translation, "All praise is due to Allah, Lord of the worlds.");
  assert.equal(result.translationLanguage, "en");
  assert.equal(result.translationSource, "trusted-translation-1");
  assert.equal(result.policy.neverReplaceArabicWithTranslation, true);
  assert.equal(result.policy.recitationLanguage, "ar");
});

test("supported export formats are constrained to project formats", () => {
  assert.deepEqual(normalizeSupportedFormats(["PDF", "docx", "epub", "zip", "pdf"]), ["pdf", "docx", "epub"]);
});
