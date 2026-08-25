import test from "node:test";
import assert from "node:assert/strict";
import { CAPABILITY } from "../src/security/security-shield.js";
import { GovernanceBlockedError, planOperation, validateOperation } from "../src/governance/orchestration-kernel.js";

const provenance = { source: "official", locator: "test-fixture", capturedAt: "2026-08-24" };
const passed = { status: "passed", checks: ["integrity", "schema"] };
const readCapabilities = [CAPABILITY.READ];
const writeCapabilities = [CAPABILITY.CORPUS_WRITE];
const publishCapabilities = [CAPABILITY.MERGE];

test("read operations require provenance", () => {
  assert.throws(() => validateOperation({ action: "read", capabilities: readCapabilities }), (error) => error instanceof GovernanceBlockedError && error.code === "PROVENANCE_REQUIRED");
});

test("missing capability fails closed before business gates", () => {
  assert.throws(() => validateOperation({ action: "read", provenance }), (error) => error instanceof GovernanceBlockedError && error.code === "SECURITY_CAPABILITY_DENIED");
});

test("search results cannot be treated as evidence", () => {
  assert.throws(() => validateOperation({ action: "read", capabilities: readCapabilities, provenance, sourceKind: "search-result" }), (error) => error.code === "SEARCH_NOT_EVIDENCE");
});

test("writes fail closed without passed validation", () => {
  assert.throws(() => validateOperation({ action: "write", capabilities: writeCapabilities, provenance }), (error) => error.code === "VALIDATION_REQUIRED");
});

test("publishing requires explicit redistribution rights", () => {
  assert.throws(() => validateOperation({ action: "publish", capabilities: publishCapabilities, provenance, validation: passed, rights: { status: "rights-unclear" } }), (error) => error.code === "RIGHTS_REQUIRED");
});

test("verified operations receive an explicit security execution plan", () => {
  const plan = planOperation({ action: "publish", capabilities: publishCapabilities, provenance, validation: passed, rights: { status: "redistributable" } });
  assert.equal(plan.status, "approved-for-execution");
  assert.deepEqual(plan.gates, ["security-capability", "provenance", "validation", "rights"]);
  assert.equal(plan.capability, CAPABILITY.MERGE);
});
