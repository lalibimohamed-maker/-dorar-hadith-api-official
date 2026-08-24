import test from "node:test";
import assert from "node:assert/strict";
import {
  CAPABILITY,
  SECURITY_MODE,
  authorize,
  createAuditEvent,
  detectAnomalies,
  lockdownStatus
} from "../src/security/security-shield.js";

test("lockdown mode denies high-impact capabilities but preserves read", () => {
  assert.deepEqual(authorize({ mode: SECURITY_MODE.LOCKDOWN, capabilities: [CAPABILITY.READ, CAPABILITY.CORPUS_WRITE], requested: CAPABILITY.READ }), { allowed: true, reason: "allowed" });
  assert.deepEqual(authorize({ mode: SECURITY_MODE.LOCKDOWN, capabilities: [CAPABILITY.CORPUS_WRITE], requested: CAPABILITY.CORPUS_WRITE }), { allowed: false, reason: "lockdown_denies_high_impact_capability" });
});

test("authorization denies missing capabilities by default", () => {
  assert.deepEqual(authorize({ capabilities: [CAPABILITY.READ], requested: CAPABILITY.MERGE }), { allowed: false, reason: "capability_not_granted" });
});

test("audit events form a hash-linked chain", () => {
  const first = createAuditEvent({ actor: "agent:test", action: "analyze", target: "source:1", result: "success" });
  const second = createAuditEvent({ actor: "agent:test", action: "propose", target: "corpus:1", result: "success", previousHash: first.hash });
  assert.equal(first.previousHash, "GENESIS");
  assert.equal(second.previousHash, first.hash);
  assert.notEqual(second.hash, first.hash);
});

test("anomaly detector catches burst of sensitive denials", () => {
  const timestamp = new Date().toISOString();
  const events = Array.from({ length: 6 }, (_, index) => ({ actor: "agent:x", action: "secret:read", target: `key:${index}`, result: "denied", timestamp }));
  const result = detectAnomalies(events, { maxFailures: 5 });
  assert.equal(result.anomalous, true);
  assert.equal(result.severity, "high");
  assert.ok(result.types.includes("repeated_sensitive_denial"));
});

test("lockdown status is derived from environment without a network dependency", () => {
  const status = lockdownStatus({ SECURITY_LOCKDOWN_MODE: "true", SECURITY_LOCKDOWN_REASON: "incident" });
  assert.deepEqual(status, { mode: "lockdown", enabled: true, reason: "incident", activatedAt: null });
});
