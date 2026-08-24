import test from "node:test";
import assert from "node:assert/strict";
import { appendAuditEvent, createAuditEvent, verifyAuditLog } from "../src/source-audit-trail.js";

test("audit events are deterministic and verifiable", () => {
  const e = createAuditEvent({ event:"source-refreshed", sourceId:"s1", revisionId:"r1", actor:"system", timestamp:"2026-08-24T00:00:00Z" });
  assert.equal(verifyAuditLog([e]), true);
});

test("secrets are excluded from audit metadata", () => {
  const e = createAuditEvent({ event:"rights-reviewed", metadata:{ license:"public", apiKey:"DO_NOT_STORE", password:"DO_NOT_STORE" } });
  assert.deepEqual(e.metadata, { license:"public" });
});

test("unsupported event types fail closed", () => {
  assert.throws(() => createAuditEvent({ event:"delete-user-data" }));
});

test("duplicate event IDs do not duplicate the log", () => {
  const e = createAuditEvent({ event:"source-discovered", sourceId:"s1", timestamp:"2026-08-24T00:00:00Z" });
  assert.equal(appendAuditEvent(appendAuditEvent([], e), e).length, 1);
});

test("tampering is detected", () => {
  const e = createAuditEvent({ event:"source-verified", sourceId:"s1", timestamp:"2026-08-24T00:00:00Z" });
  const tampered = { ...e, reason:"changed" };
  assert.equal(verifyAuditLog([tampered]), false);
});
