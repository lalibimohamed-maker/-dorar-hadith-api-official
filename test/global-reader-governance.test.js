import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildBookDeliveryPolicy, buildQuranReadingRepresentation, resolveRequestedLanguage } from "../src/universal-reader-policy.js";

const contract = JSON.parse(fs.readFileSync(new URL("../config/global-reader-2026.json", import.meta.url), "utf8"));

test("global reader contract enforces explicit language precedence", () => {
  assert.equal(resolveRequestedLanguage({ browserLanguage: "fr" }), "fr");
  assert.equal(resolveRequestedLanguage({ browserLanguage: "fr", requestedLanguage: "en" }), "en");
});

test("global reader contract keeps reading representation separate from redistribution master", () => {
  const reader = buildBookDeliveryPolicy({
    rights: { status: "read-only" },
    sourceAllowsReading: true,
    sourceAllowsCopy: false,
    provenanceVerified: true,
    validationPassed: true,
    language: { browserLanguage: "fr" }
  });
  assert.equal(reader.canRead, true);
  assert.equal(reader.canDownloadDigitalMaster, false);
  assert.equal(reader.mode, "reader-only");
  assert.equal(reader.distinction, "Reading Representation != Redistribution Master");
});

test("global reader contract requires provenance and validation before digital master", () => {
  const ready = buildBookDeliveryPolicy({
    rights: { status: "public-domain" },
    provenanceVerified: true,
    validationPassed: true
  });
  assert.equal(ready.canDownloadDigitalMaster, true);
  const blocked = buildBookDeliveryPolicy({
    rights: { status: "public-domain" },
    provenanceVerified: false,
    validationPassed: true
  });
  assert.equal(blocked.canDownloadDigitalMaster, false);
});

test("Quran contract keeps Arabic primary and translation metadata separate", () => {
  const value = buildQuranReadingRepresentation({
    arabicText: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
    translation: "In the name of Allah, the Most Merciful, the Especially Merciful.",
    translationLanguage: "en",
    translationSource: "verified-translation"
  });
  assert.equal(value.arabicText.startsWith("بِسْمِ اللَّهِ"), true);
  assert.equal(value.translationLanguage, "en");
  assert.equal(value.translationSource, "verified-translation");
  assert.equal(value.policy.neverReplaceArabicWithTranslation, true);
});

test("global reader configuration matches the implementation contract", () => {
  assert.equal(contract.languagePolicy.browserLanguageDefault, true);
  assert.equal(contract.languagePolicy.explicitRequestedLanguageWins, true);
  assert.deepEqual(contract.digitalMaster.supportedFormats, ["pdf", "docx", "epub"]);
  assert.equal(contract.rightsPolicy.readDoesNotImplyRedistribution, true);
  assert.equal(contract.quran.arabicTextCanonical, true);
  assert.equal(contract.quran.translationDoesNotReplaceArabic, true);
});
