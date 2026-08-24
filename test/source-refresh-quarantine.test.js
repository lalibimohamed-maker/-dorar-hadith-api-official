import test from "node:test";
import assert from "node:assert/strict";
import { canApplyRefresh, inspectSourceRefresh, REFRESH_STATE } from "../src/source-refresh-quarantine.js";

test("unchanged source is safe and does not create a new edition", () => {
  const r = inspectSourceRefresh({ sourceId: "s1", sourceUrl: "https://example", previousHash: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824", fetchedContent: "hello" });
  assert.equal(r.state, REFRESH_STATE.unchanged);
});

test("changed protected source is quarantined", () => {
  const r = inspectSourceRefresh({ sourceId: "s2", sourceUrl: "https://official", previousHash: "a".repeat(64), fetchedContent: "new", rights: "link-only" });
  assert.equal(r.state, REFRESH_STATE.quarantined);
  assert.equal(canApplyRefresh(r), false);
});

test("changed redistributable source requires review before applying", () => {
  const r = inspectSourceRefresh({ sourceId: "s3", sourceUrl: "https://example", previousHash: "a".repeat(64), fetchedContent: "new", rights: "redistributable" });
  assert.equal(r.state, REFRESH_STATE.changed);
  assert.equal(r.requiresReview, true);
  assert.equal(canApplyRefresh(r), true);
});

test("missing capture never overwrites anything", () => {
  const r = inspectSourceRefresh({ sourceId: "s4", sourceUrl: "https://example" });
  assert.equal(r.state, REFRESH_STATE.candidate);
  assert.equal(canApplyRefresh(r), false);
});
