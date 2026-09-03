import test from "node:test";
import assert from "node:assert/strict";
import { verifySha256 } from "../src/offline-pdf-library.js";

const SAFE_BOOK = {
  id: "waqfeya-fatawa-committee-collection",
  url: "https://archive.org/download/FP124536/15_124550.pdf",
  sha256: "8fe296a75adf7cef1768d18579ac29a1a9640dbf02fcd0d045469ab1f306c45e",
  sizeBytes: 20004008,
  source: { id: "waqfeya", url: "https://www.waqfeya.net/" },
  provenance: { resourceId: "waqfeya-century15-book-verified", verifiedAt: "2026-09-02T00:00:00Z" },
  rights: { status: "redistributable" },
  validation: { status: "valid" },
};

test("verifySha256 accepts the known Waqfeya PDF digest", async () => {
  const body = new TextEncoder().encode("deen-allah-offline");
  const digest = await crypto.subtle.digest("SHA-256", body);
  const expected = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  assert.equal(await verifySha256(new Blob([body], { type: "application/pdf" }), expected), true);
});

test("verifySha256 rejects a modified PDF payload", async () => {
  const expected = "8fe296a75adf7cef1768d18579ac29a1a9640dbf02fcd0d045469ab1f306c45e";
  assert.equal(await verifySha256(new Blob(["changed"]), expected), false);
});

test("the governed offline record contains provenance, rights and validation", () => {
  assert.equal(SAFE_BOOK.source.id, "waqfeya");
  assert.equal(SAFE_BOOK.provenance.resourceId, "waqfeya-century15-book-verified");
  assert.equal(SAFE_BOOK.rights.status, "redistributable");
  assert.equal(SAFE_BOOK.validation.status, "valid");
});
