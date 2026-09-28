import test from "node:test";
import assert from "node:assert/strict";
import { buildReligiousScholarlyDeliveryPlan, classifyBookForDelivery, CONTENT_SCOPE, DELIVERY_PIPELINE } from "../src/universal-religious-scholarly-delivery.js";

test("religious scholarly book is in scope", () => {
  const r = classifyBookForDelivery({ domain: CONTENT_SCOPE.IN_SCOPE, rights: { status: "public-domain" } });
  assert.equal(r.scope, CONTENT_SCOPE.IN_SCOPE);
  assert.equal(r.redistributable, true);
});

test("general-world books are out of scope", () => {
  const r = classifyBookForDelivery({ domain: CONTENT_SCOPE.OUT_OF_SCOPE, rights: { status: "public-domain" } });
  assert.equal(r.eligible, false);
  assert.equal(r.scope, CONTENT_SCOPE.OUT_OF_SCOPE);
});

test("unapproved sources are not delivered as trusted corpus", () => {
  const r = classifyBookForDelivery({ domain: CONTENT_SCOPE.IN_SCOPE, sourceClass: "unapproved", rights: { status: "public-domain" } });
  assert.equal(r.eligible, false);
});

test("comparative-critical material is not promoted to approved source", () => {
  const r = classifyBookForDelivery({ domain: CONTENT_SCOPE.IN_SCOPE, sourceClass: "comparative-critical", rights: { status: "read-only" } });
  assert.equal(r.eligible, false);
  assert.equal(r.comparativeOnly, true);
});

test("Quran keeps a special Arabic-source policy", () => {
  const r = classifyBookForDelivery({ domain: CONTENT_SCOPE.IN_SCOPE, quran: true, rights: { status: "unknown" } });
  assert.equal(r.quranSpecialPolicy, true);
  assert.equal(r.scope, CONTENT_SCOPE.IN_SCOPE);
});


test("comparative-critical material stays descriptive and outside trusted corpus", () => {
  const r = classifyBookForDelivery({
    domain: CONTENT_SCOPE.IN_SCOPE,
    sourceClass: "comparative-critical",
    rights: { status: "read-only" }
  });
  assert.equal(r.eligible, false);
  assert.equal(r.trustedCorpus, false);
  assert.equal(r.comparativeOnly, true);
});

test("delivery plan requires rights, provenance, multi-OCR alignment and quality control before digital master", () => {
  const ready = buildReligiousScholarlyDeliveryPlan({
    domain: CONTENT_SCOPE.IN_SCOPE,
    sourceClass: "approved",
    rights: { status: "licensed" },
    provenance: { verified: true },
    ocr: { status: "aligned" },
    validation: { status: "passed" },
    browserLanguage: "fr"
  });
  assert.deepEqual(ready.pipeline, [...DELIVERY_PIPELINE]);
  assert.equal(ready.language, "fr");
  assert.equal(ready.digitalMasterEligible, true);
  assert.deepEqual(ready.downloadFormats, ["pdf", "docx", "epub"]);

  const blockedOcr = buildReligiousScholarlyDeliveryPlan({
    domain: CONTENT_SCOPE.IN_SCOPE,
    sourceClass: "approved",
    rights: { status: "licensed" },
    provenance: { verified: true },
    ocr: { status: "needs-review" },
    validation: { status: "passed" },
    browserLanguage: "fr"
  });
  assert.equal(blockedOcr.digitalMasterEligible, false);
});

test("explicit requested language overrides browser language", () => {
  const plan = buildReligiousScholarlyDeliveryPlan({
    domain: CONTENT_SCOPE.IN_SCOPE,
    browserLanguage: "fr",
    requestedLanguage: "en"
  });
  assert.equal(plan.language, "en");
  assert.equal(plan.languageSource, "explicit-request");
});

test("protected books remain reader/reference-only even when readable", () => {
  const plan = buildReligiousScholarlyDeliveryPlan({
    domain: CONTENT_SCOPE.IN_SCOPE,
    sourceClass: "approved",
    rights: { status: "read-only" },
    provenance: { verified: true },
    ocr: { status: "aligned" },
    validation: { status: "passed" }
  });
  assert.equal(plan.digitalMasterEligible, false);
  assert.equal(plan.readerMode, "reader/source-reference");
  assert.deepEqual(plan.downloadFormats, []);
});
