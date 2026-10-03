import test from "node:test";
import assert from "node:assert/strict";
import { BookIngestionGovernanceError, authorizeBookAction, validateBookIngestionRequest } from "../src/governance/book-ingestion.js";

const baseRequest = {
  resourceId: "book-fixture-1",
  source: { id: "institutional-source", url: "https://example.invalid/book" },
  provenance: { resourceId: "book-fixture-1", source: "institutional-source", edition: "verified-edition" },
  rights: { status: "licensed" },
  validation: { status: "passed" }
};

test("book governance requires all five admission fields", () => {
  assert.throws(() => validateBookIngestionRequest({ resourceId: "book-fixture-1" }), (error) => error.code === "SOURCE_REQUIRED");
  assert.throws(() => validateBookIngestionRequest({ ...baseRequest, provenance: null }), (error) => error.code === "PROVENANCE_REQUIRED");
  assert.throws(() => validateBookIngestionRequest({ ...baseRequest, validation: { status: "pending" } }), (error) => error.code === "VALIDATION_REQUIRED");
});

test("unknown or restricted rights fail closed", () => {
  for (const status of ["unknown", "rights-unclear", "restricted"]) {
    assert.throws(() => validateBookIngestionRequest({ ...baseRequest, rights: { status } }), (error) => error.code === "RIGHTS_REQUIRED");
  }
});

test("source without a stable id or http(s) URL fails closed", () => {
  assert.throws(() => validateBookIngestionRequest({
    ...baseRequest,
    source: { url: "https://example.invalid/book" }
  }), (error) => error.code === "SOURCE_REQUIRED");
  assert.throws(() => validateBookIngestionRequest({
    ...baseRequest,
    source: { id: "source", url: "file:///tmp/book.pdf" }
  }), (error) => error.code === "SOURCE_REQUIRED");
});

test("verified rights permit all explicit book actions", () => {
  for (const action of ["ingest", "publish", "export"]) {
    const result = authorizeBookAction(baseRequest, action);
    assert.deepEqual(result, {
      action,
      resourceId: "book-fixture-1",
      authorized: true,
      governance: {
        delegatedTo: "orchestration-kernel",
        corpusMutation: false,
        ocrExecution: false
      }
    });
  }
});

test("unsupported actions are rejected before execution", () => {
  assert.throws(
    () => authorizeBookAction(baseRequest, "delete"),
    (error) => error instanceof BookIngestionGovernanceError && error.code === "ACTION_INVALID"
  );
});

test("ingestion governance itself does not execute OCR or write book content", () => {
  const result = validateBookIngestionRequest(baseRequest);
  assert.equal(result.governance.corpusMutation, false);
  assert.equal(result.governance.ocrExecution, false);
});
