import test from "node:test";
import assert from "node:assert/strict";
import { evaluateBookCacheRequest, BOOK_CACHE_STATES } from "../src/book-cache-policy.js";

const valid = {
  source: { id: "official-source", url: "https://example.invalid/book" },
  provenance: { resourceId: "book-001", verifiedAt: "2026-08-24T00:00:00Z" },
  rights: { status: "licensed" },
  validation: { status: "valid" }
};

test("verified licensed book may enter cache", () => {
  const result = evaluateBookCacheRequest(valid);
  assert.equal(result.allowed, true);
  assert.equal(result.state, BOOK_CACHE_STATES.CACHED);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.gates, ["source", "provenance", "rights", "validation"]);
});

test("unknown rights fail closed", () => {
  const result = evaluateBookCacheRequest({ ...valid, rights: { status: "unknown" } });
  assert.equal(result.allowed, false);
  assert.equal(result.state, BOOK_CACHE_STATES.BLOCKED);
  assert.ok(result.failures.includes("rights_not_verified"));
});

test("missing provenance fails closed", () => {
  const result = evaluateBookCacheRequest({ ...valid, provenance: {} });
  assert.equal(result.allowed, false);
  assert.ok(result.failures.includes("provenance_required"));
});

test("invalid verification timestamp fails closed", () => {
  const result = evaluateBookCacheRequest({
    ...valid,
    provenance: { resourceId: "book-001", verifiedAt: "not-a-date" }
  });
  assert.equal(result.allowed, false);
  assert.ok(result.failures.includes("provenance_required"));
});

test("non-http source URL fails closed", () => {
  const result = evaluateBookCacheRequest({
    ...valid,
    source: { id: "book", url: "file:///tmp/book.pdf" }
  });
  assert.equal(result.allowed, false);
  assert.ok(result.failures.includes("source_required"));
});

test("validation must be successful", () => {
  const result = evaluateBookCacheRequest({ ...valid, validation: { status: "invalid" } });
  assert.equal(result.allowed, false);
  assert.ok(result.failures.includes("validation_required"));
});

test("passed validation is also accepted for governance interoperability", () => {
  const result = evaluateBookCacheRequest({ ...valid, validation: { status: "passed" } });
  assert.equal(result.allowed, true);
});
