import test from "node:test";
import assert from "node:assert/strict";
import { appendRevision, canRestore, latestVerified, recordRefresh } from "../src/source-refresh-history.js";

test("records immutable revision lineage", () => {
  const a = recordRefresh(null, { sourceId:"s1", contentHash:"a".repeat(64), capturedAt:"2026-08-24", state:"verified", rights:"redistributable" });
  const b = recordRefresh(a, { sourceId:"s1", contentHash:"b".repeat(64), capturedAt:"2026-08-25", state:"quarantined", rights:"link-only" });
  assert.equal(b.parentRevisionId, a.revisionId);
});

test("deduplicates identical revision records", () => {
  const a = recordRefresh(null, { sourceId:"s1", contentHash:"a".repeat(64) });
  assert.equal(appendRevision(appendRevision([], a), a).length, 1);
});

test("finds last verified revision for recovery", () => {
  const a = recordRefresh(null, { sourceId:"s1", contentHash:"a".repeat(64), state:"verified" });
  const b = recordRefresh(a, { sourceId:"s1", contentHash:"b".repeat(64), state:"quarantined" });
  const history = appendRevision(appendRevision([], a), b);
  assert.equal(latestVerified(history).revisionId, a.revisionId);
  assert.equal(canRestore(a, history), true);
  assert.equal(canRestore(b, history), false);
});
