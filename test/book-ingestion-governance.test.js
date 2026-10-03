import test from "node:test";
import assert from "node:assert/strict";
import {
  BookIngestionGovernanceError,
  authorizeBookAction,
  authorizeVerificationDownload,
  validateBookIngestionRequest
} from "../src/governance/book-ingestion.js";

const baseRequest = {
  resourceId: "book-fixture-1",
  source: "institutional-source",
  provenance: { edition: "verified-edition" },
  rights: { status: "licensed" },
  validation: "passed"
};

test("book ingestion requires provenance, rights and validation", () => {
  assert.throws(() => validateBookIngestionRequest({ resourceId: "book-fixture-1" }), (error) => error.code === "SOURCE_REQUIRED");
  assert.throws(() => validateBookIngestionRequest({ ...baseRequest, provenance: null }), (error) => error.code === "PROVENANCE_REQUIRED");
  assert.throws(() => validateBookIngestionRequest({ ...baseRequest, validation: "pending" }), (error) => error.code === "VALIDATION_REQUIRED");
});

test("unclear or restricted rights fail closed for publication ingestion", () => {
  for (const status of ["unknown", "rights-unclear", "restricted"]) {
    assert.throws(() => validateBookIngestionRequest({ ...baseRequest, rights: { status } }), (error) => error.code === "RIGHTS_NOT_VERIFIED");
  }
});

test("verified rights permit an explicit book action", () => {
  const result = authorizeBookAction(baseRequest, "ingest");
  assert.deepEqual(result, { action: "ingest", resourceId: "book-fixture-1", authorized: true });
});

test("unsupported actions are rejected", () => {
  assert.throws(() => authorizeBookAction(baseRequest, "delete"), (error) => error instanceof BookIngestionGovernanceError && error.code === "ACTION_INVALID");
});

test("public source with not-granted redistribution can be downloaded for internal verification", () => {
  const result = authorizeVerificationDownload({
    resourceId: "book-fixture-review",
    source: "public-institutional-page",
    provenance: { sourceUrl: "https://example.invalid/book" },
    rights: { status: "rights-unclear" },
    sourceAccess: "public",
    verificationUse: "internal",
    redistributionPermission: "not-granted"
  });

  assert.equal(result.action, "verify-download");
  assert.equal(result.authorized, true);
  assert.equal(result.redistributionPermission, "not-granted");
});

test("verification download does not authorize redistribution", () => {
  assert.throws(() => authorizeVerificationDownload({
    resourceId: "book-fixture-review",
    source: "public-institutional-page",
    provenance: { sourceUrl: "https://example.invalid/book" },
    rights: { status: "rights-unclear" },
    sourceAccess: "public",
    verificationUse: "internal",
    redistributionPermission: "granted"
  }), (error) => error.code === "REDISTRIBUTION_SEPARATION_REQUIRED");
});

test("verification download requires explicit public access and internal use", () => {
  const baseVerification = {
    resourceId: "book-fixture-review",
    source: "public-institutional-page",
    provenance: { sourceUrl: "https://example.invalid/book" },
    rights: { status: "rights-unclear" },
    sourceAccess: "public",
    verificationUse: "internal",
    redistributionPermission: "not-granted"
  };

  assert.throws(() => authorizeVerificationDownload({ ...baseVerification, sourceAccess: "unknown" }), (error) => error.code === "SOURCE_ACCESS_NOT_PUBLIC");
  assert.throws(() => authorizeVerificationDownload({ ...baseVerification, verificationUse: "public" }), (error) => error.code === "VERIFICATION_USE_REQUIRED");
  assert.throws(() => authorizeVerificationDownload({ ...baseVerification, rights: { status: "restricted" } }), (error) => error.code === "VERIFICATION_DOWNLOAD_BLOCKED");
});
