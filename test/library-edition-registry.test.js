import test from "node:test";
import assert from "node:assert/strict";
import { canPersistBytes, canPersistReference, createEditionRecord, isIntegrityMatch, CACHE_POLICY } from "../src/library-edition-registry.js";

test("protected source becomes reference-only", () => {
  const r = createEditionRecord({ sourceUrl: "https://official.example/book", contentHash: "a".repeat(64), rights: "link-only" });
  assert.equal(r.policy, CACHE_POLICY.reference);
  assert.equal(canPersistBytes(r), false);
  assert.equal(canPersistReference(r), true);
});

test("unclear rights go to quarantine", () => {
  const r = createEditionRecord({ sourceUrl: "https://example/book", contentHash: "b".repeat(64) });
  assert.equal(r.policy, CACHE_POLICY.quarantine);
  assert.equal(canPersistBytes(r), false);
});

test("redistributable edition may be persisted", () => {
  const r = createEditionRecord({ sourceUrl: "https://example/book", contentHash: "c".repeat(64), rights: "redistributable" });
  assert.equal(r.policy, CACHE_POLICY.immutable);
  assert.equal(canPersistBytes(r), true);
});

test("integrity is content-hash based", () => {
  const r = createEditionRecord({ sourceUrl: "https://example/book", contentHash: "2bb80d537b1da3e38bd30361aa855686bde0ba5a4e6b7b7a5f9f4d3f3f6b1c0a" });
  assert.equal(isIntegrityMatch(r, "hello"), false);
});
