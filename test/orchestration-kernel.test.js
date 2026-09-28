import test from "node:test";
import assert from "node:assert/strict";
import { GovernanceBlockedError, planOperation, validateOperation } from "../src/governance/orchestration-kernel.js";

const provenance = { source: "official", locator: "test-fixture", capturedAt: "2026-08-24" };
const passed = { status: "passed", checks: ["integrity", "schema"] };
const bookOperation = {
  resourceId: "book-fixture-1",
  source: { id: "official", url: "https://example.invalid/book" },
  provenance: { resourceId: "book-fixture-1", source: "official" },
  validation: passed,
  rights: { status: "redistributable" }
};

test("read operations require provenance", () => {
  assert.throws(() => validateOperation({ action: "read" }), (error) => error instanceof GovernanceBlockedError && error.code === "PROVENANCE_REQUIRED");
});

test("search results cannot be treated as evidence", () => {
  assert.throws(() => validateOperation({ action: "read", provenance, sourceKind: "search-result" }), (error) => error.code === "SEARCH_NOT_EVIDENCE");
});

test("writes fail closed without passed validation", () => {
  assert.throws(() => validateOperation({ action: "write", provenance }), (error) => error.code === "VALIDATION_REQUIRED");
});

test("publishing requires explicit redistribution rights", () => {
  assert.throws(() => validateOperation({
    ...bookOperation,
    rights: { status: "rights-unclear" },
    action: "publish"
  }), (error) => error.code === "RIGHTS_REQUIRED");
});

test("verified book publish operations receive an explicit execution plan", () => {
  const plan = planOperation({ ...bookOperation, action: "publish" });
  assert.equal(plan.status, "approved-for-execution");
  assert.deepEqual(plan.gates, ["resourceId", "source", "provenance", "rights", "validation"]);
});

test("book publish operations reject missing identity gates", () => {
  assert.throws(() => validateOperation({ ...bookOperation, action: "publish", resourceId: "" }), (error) => error.code === "RESOURCE_ID_REQUIRED");
  assert.throws(() => validateOperation({ ...bookOperation, action: "publish", source: null }), (error) => error.code === "SOURCE_REQUIRED");
  assert.throws(() => validateOperation({ ...bookOperation, action: "publish", provenance: null }), (error) => error.code === "PROVENANCE_REQUIRED");
  assert.throws(() => validateOperation({ ...bookOperation, action: "publish", validation: { status: "pending" } }), (error) => error.code === "VALIDATION_REQUIRED");
});
