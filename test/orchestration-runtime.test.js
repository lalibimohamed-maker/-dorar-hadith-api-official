import test from "node:test";
import assert from "node:assert/strict";
import { planOrchestration, requiredGates } from "../src/orchestration-kernel.js";
import { CAPABILITY } from "../src/security/security-shield.js";

const provenance = { source: "official", locator: "fixture", capturedAt: "2026-08-24" };
const validation = { status: "passed", checks: ["integrity", "schema"] };

test("routes a verified read through the governance boundary", () => {
  const plan = planOrchestration({
    action: "read",
    capabilities: [CAPABILITY.READ],
    provenance,
    requestId: "r1"
  });
  assert.equal(plan.route, "read");
  assert.equal(plan.status, "approved-for-execution");
});

test("fails closed for unknown operations", () => {
  assert.throws(() => planOrchestration({ action: "attack", provenance }), /fail closed/);
});

test("publish requires validation and redistribution rights", () => {
  const capabilities = [CAPABILITY.MERGE];
  assert.throws(() => planOrchestration({
    action: "publish", provenance, validation, capabilities,
    rights: { status: "rights-unclear" }
  }), /Redistribution rights/);
  const plan = planOrchestration({
    action: "publish", provenance, validation, capabilities,
    rights: { status: "redistributable" }
  });
  assert.deepEqual(plan.gates, ["security-capability", "provenance", "validation", "rights"]);
});

test("gate policy is deterministic", () => {
  assert.deepEqual(requiredGates("discover"), ["provenance"]);
  assert.deepEqual(requiredGates("write"), ["provenance", "validation"]);
  assert.deepEqual(requiredGates("export"), ["provenance", "validation", "rights"]);
});
