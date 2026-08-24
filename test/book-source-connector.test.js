import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSourceConnectorRequest, SOURCE_CONNECTOR_STATES } from "../src/book-source-connector.js";

const valid = {
  source: { id: "official-source", url: "https://example.invalid/book" },
  provenance: { resourceId: "book-001", verifiedAt: "2026-08-24T00:00:00Z" },
  rights: { status: "licensed" },
  validation: { status: "valid" }
};

test("verified source may be fetched", () => {
  const result = evaluateSourceConnectorRequest(valid);
  assert.equal(result.allowed, true);
  assert.equal(result.state, SOURCE_CONNECTOR_STATES.FETCHABLE);
});

test("unknown rights block fetching", () => {
  const result = evaluateSourceConnectorRequest({ ...valid, rights: { status: "unknown" } });
  assert.equal(result.allowed, false);
  assert.equal(result.state, SOURCE_CONNECTOR_STATES.BLOCKED);
  assert.ok(result.failures.includes("rights_not_verified"));
});

test("missing provenance blocks fetching", () => {
  const result = evaluateSourceConnectorRequest({ ...valid, provenance: {} });
  assert.equal(result.allowed, false);
  assert.ok(result.failures.includes("provenance_required"));
});

test("invalid validation blocks fetching", () => {
  const result = evaluateSourceConnectorRequest({ ...valid, validation: { status: "invalid" } });
  assert.equal(result.allowed, false);
  assert.ok(result.failures.includes("validation_required"));
});
