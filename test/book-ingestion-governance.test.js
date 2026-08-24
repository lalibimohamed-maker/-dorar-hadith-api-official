import test from "node:test";
import assert from "node:assert/strict";
import { BookIngestionGovernanceError, authorizeBookAction, validateBookIngestionRequest } from "../src/governance/book-ingestion.js";

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

test("unclear or restricted rights fail closed", () => {
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
