import test from "node:test";
import assert from "node:assert/strict";
import { GovernanceBlockedError, planOperation, validateOperation } from "../src/governance/orchestration-kernel.js";

const provenance = { source: "official", locator: "test-fixture", capturedAt: "2026-08-24" };
const passed = { status: "passed", checks: ["integrity", "schema"] };

test("every operation declares a type and complete provenance", () => {
  assert.throws(
    () => validateOperation({ provenance }),
    (error) => error instanceof GovernanceBlockedError && error.code === "ACTION_NOT_ALLOWED"
  );
  assert.throws(
    () => validateOperation({ action: "read", provenance: { source: "official" } }),
    (error) => error instanceof GovernanceBlockedError && error.code === "PROVENANCE_REQUIRED"
  );
  const result = validateOperation({ action: "read", provenance });
  assert.equal(result.operationType, "read");
  assert.equal(result.source, "official");
});

test("search results are discovery inputs, not source evidence", () => {
  const discovery = validateOperation({ action: "discover", provenance, sourceKind: "search-result" });
  assert.equal(discovery.ok, true);
  assert.throws(
    () => validateOperation({ action: "read", provenance, sourceKind: "search-result" }),
    (error) => error.code === "SEARCH_NOT_EVIDENCE"
  );
});

test("writes fail closed without passed validation", () => {
  assert.throws(
    () => validateOperation({ action: "write", provenance }),
    (error) => error.code === "VALIDATION_REQUIRED"
  );
});

test("publishing and export require explicit redistribution rights", () => {
  for (const action of ["publish", "export"]) {
    assert.throws(
      () => validateOperation({ action, provenance, validation: passed, rights: { status: "rights-unclear" } }),
      (error) => error.code === "RIGHTS_REQUIRED"
    );
    const result = validateOperation({
      action, provenance, validation: passed, rights: { status: "redistributable" }
    });
    assert.equal(result.ok, true);
  }
});

test("verified operations receive a deterministic execution plan", () => {
  const plan = planOperation({
    action: "publish",
    provenance,
    validation: passed,
    rights: { status: "redistributable" }
  });
  assert.equal(plan.status, "approved-for-execution");
  assert.deepEqual(plan.gates, ["provenance", "validation", "rights"]);
});

test("fail closed is a gate, not a permission-grant mechanism", () => {
  assert.throws(
    () => validateOperation({ action: "delete", provenance }),
    (error) => error.code === "ACTION_NOT_ALLOWED"
  );
});

test("the governance kernel does not mutate Corpus", () => {
  const plan = planOperation({ action: "read", provenance });
  assert.equal(plan.ok, true);
  assert.equal("corpusMutation" in plan, false);
});
