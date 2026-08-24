import test from "node:test";
import assert from "node:assert/strict";
import { GovernanceBlockedError, planOperation, validateOperation } from "../src/governance/orchestration-kernel.js";

const provenance = { source: "official", locator: "test-fixture", capturedAt: "2026-08-24" };
const passed = { status: "passed", checks: ["integrity", "schema"] };

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
  assert.throws(() => validateOperation({ action: "publish", provenance, validation: passed, rights: { status: "rights-unclear" } }), (error) => error.code === "RIGHTS_REQUIRED");
});

test("verified operations receive an explicit execution plan", () => {
  const plan = planOperation({ action: "publish", provenance, validation: passed, rights: { status: "redistributable" } });
  assert.equal(plan.status, "approved-for-execution");
  assert.deepEqual(plan.gates, ["provenance", "validation", "rights"]);
});
