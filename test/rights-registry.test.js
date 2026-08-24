import test from "node:test";
import assert from "node:assert/strict";
import { RightsRegistryError, assertRedistributable, canRedistribute, createRightsRecord } from "../src/governance/rights-registry.js";

const verified = {
  resourceId: "fixture-1",
  status: "licensed",
  basis: "explicit-license",
  source: "https://example.invalid/rights",
  verifiedAt: "2026-08-24",
  verifier: "governance-test"
};

test("rights records require provenance-like verification metadata", () => {
  assert.throws(() => createRightsRecord({ resourceId: "fixture-1", status: "licensed" }), (error) => error instanceof RightsRegistryError && error.code === "BASIS_REQUIRED");
});

test("unknown or restricted rights never become redistributable", () => {
  assert.equal(canRedistribute(createRightsRecord({ ...verified, status: "rights-unclear" })), false);
  assert.equal(canRedistribute(createRightsRecord({ ...verified, status: "restricted" })), false);
});

test("verified licensed resources may pass the redistribution gate", () => {
  const record = createRightsRecord(verified);
  assert.equal(canRedistribute(record), true);
  assert.equal(assertRedistributable(record), true);
});

test("redistribution gate fails closed", () => {
  assert.throws(() => assertRedistributable(createRightsRecord({ ...verified, status: "unknown" })), (error) => error.code === "REDISTRIBUTION_NOT_VERIFIED");
});
