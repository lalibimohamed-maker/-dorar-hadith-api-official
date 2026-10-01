import test from "node:test";
import assert from "node:assert/strict";
import { accessModeForRights, buildBookDeliveryPolicy, canOfferAcademicQuote, canOfferOfflineDownload } from "../src/library-access-policy.js";

test("rights-cleared books are downloadable", () => {
  assert.equal(accessModeForRights("redistributable"), "redistributable");
  const policy = buildBookDeliveryPolicy({ rightsStatus: "redistributable" });
  assert.equal(policy.download, true);
  assert.equal(policy.offlineBundle, true);
});

test("rights-restricted books are reference-only", () => {
  assert.equal(accessModeForRights("rights-restricted"), "reference-only");
  const policy = buildBookDeliveryPolicy({ rightsStatus: "rights-restricted" });
  assert.equal(policy.reader, true);
  assert.equal(policy.search, true);
  assert.equal(policy.download, false);
  assert.equal(policy.offlineBundle, false);
  assert.equal(policy.copy, "citation-bounded");
  assert.equal(canOfferAcademicQuote({ rightsStatus: "rights-restricted" }), true);
  assert.equal(canOfferOfflineDownload({ rightsStatus: "rights-restricted" }), false);
});

test("source-specific no-copy terms can disable quotation UI", () => {
  const policy = buildBookDeliveryPolicy({
    rightsStatus: "rights-restricted",
    sourceTerms: { copy: false }
  });
  assert.equal(policy.download, false);
  assert.equal(policy.copy, false);
  assert.equal(canOfferAcademicQuote({ rightsStatus: "rights-restricted", sourceTerms: { copy: false } }), false);
});

test("unclear rights fall back to official/external reader mode", () => {
  const policy = buildBookDeliveryPolicy({ rightsStatus: "rights-unclear" });
  assert.equal(policy.mode, "external-reader");
  assert.equal(policy.download, false);
  assert.equal(policy.reader, false);
});

test("official-source mode never becomes a download license", () => {
  const policy = buildBookDeliveryPolicy({ rightsStatus: "link-only" });
  assert.equal(policy.mode, "external-reader");
  assert.equal(policy.download, false);
});
