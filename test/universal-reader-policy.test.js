import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBookDeliveryPolicy,
  canCopyBookText,
  canReadBook,
  canRedistributeBook,
  QURAN_POLICY
} from "../src/universal-reader-policy.js";

test("full redistribution rights allow reading, Copy Text and full download", () => {
  const result = buildBookDeliveryPolicy({
    rights: { status: "public-domain" },
    language: { browserLanguage: "fr" }
  });
  assert.equal(result.language, "fr");
  assert.equal(result.canRead, true);
  assert.equal(result.canCopyText, true);
  assert.equal(result.canDownloadDigitalMaster, true);
  assert.deepEqual(result.permissions, {
    reading: true,
    copyText: true,
    fullRedistribution: true
  });
  assert.equal(result.mode, "digital-master");
});

test("licensed and redistributable statuses permit full redistribution", () => {
  for (const status of ["redistributable", "licensed", "public-domain"]) {
    assert.equal(canReadBook({ rights: { status } }), true);
    assert.equal(canCopyBookText({ rights: { status } }), true);
    assert.equal(canRedistributeBook({ rights: { status } }), true);
  }
});

test("read-copy permits reading and Copy Text but not the digital master", () => {
  const result = buildBookDeliveryPolicy({
    rights: { status: "read-copy" }
  });
  assert.equal(result.canRead, true);
  assert.equal(result.canCopyText, true);
  assert.equal(result.canDownloadDigitalMaster, false);
  assert.equal(result.mode, "reader-only");
});

test("read-only requires source reading permission and never grants Copy Text by itself", () => {
  const denied = buildBookDeliveryPolicy({
    rights: { status: "read-only" }
  });
  assert.equal(denied.canRead, false);
  assert.equal(denied.canCopyText, false);

  const allowed = buildBookDeliveryPolicy({
    rights: { status: "read-only" },
    sourceAllowsReading: true
  });
  assert.equal(allowed.canRead, true);
  assert.equal(allowed.canCopyText, false);
  assert.equal(allowed.canDownloadDigitalMaster, false);
});

test("source-explicit reading and copying can enable those separate permissions", () => {
  const result = buildBookDeliveryPolicy({
    rights: { status: "rights-unclear" },
    sourceAllowsReading: true,
    sourceAllowsCopy: true
  });
  assert.equal(result.canRead, true);
  assert.equal(result.canCopyText, true);
  assert.equal(result.canDownloadDigitalMaster, false);
  assert.equal(result.mode, "reader-only");
});

test("restricted rights stay blocked even when permissive source flags are supplied", () => {
  const result = buildBookDeliveryPolicy({
    rights: { status: "restricted" },
    sourceAllowsReading: true,
    sourceAllowsCopy: true
  });
  assert.equal(result.canRead, false);
  assert.equal(result.canCopyText, false);
  assert.equal(result.canDownloadDigitalMaster, false);
});

test("unknown rights do not create a reading, copy or download permission", () => {
  const result = buildBookDeliveryPolicy({
    rights: { status: "unknown" },
    language: { browserLanguage: "fr" }
  });
  assert.equal(result.canDownloadDigitalMaster, false);
  assert.equal(result.canCopyText, false);
  assert.equal(result.canRead, false);
  assert.equal(result.mode, "source-link");
});

test("link-only requires explicit source permission before reading", () => {
  const denied = buildBookDeliveryPolicy({
    rights: { status: "link-only" }
  });
  assert.equal(denied.canRead, false);

  const allowed = buildBookDeliveryPolicy({
    rights: { status: "link-only" },
    sourceAllowsReading: true
  });
  assert.equal(allowed.canRead, true);
  assert.equal(allowed.canCopyText, false);
});

test("source copy permission alone does not silently create Copy Text access", () => {
  const result = buildBookDeliveryPolicy({
    rights: { status: "read-only" },
    sourceAllowsCopy: true,
    sourceAllowsReading: false
  });
  assert.equal(result.canCopyText, false);
});

test("requested language overrides browser language", () => {
  const result = buildBookDeliveryPolicy({
    rights: { status: "public-domain" },
    language: { browserLanguage: "fr", requestedLanguage: "en" }
  });
  assert.equal(result.language, "en");
});

test("Quran Arabic remains canonical while meaning translation is presented below it", () => {
  assert.equal(QURAN_POLICY.arabicText, "canonical-arabic-source");
  assert.equal(QURAN_POLICY.neverReplaceArabicWithTranslation, true);
  assert.equal(QURAN_POLICY.translationMode, "meaning-translation-below-arabic");
});
