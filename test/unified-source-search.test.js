import assert from "node:assert/strict";
import test from "node:test";
import { buildUnifiedSourceRecords } from "../src/unified-search.js";
import { searchUnified } from "../src/unified-knowledge-index.js";

test("unified source records include both sources and book catalog", () => {
  const records = buildUnifiedSourceRecords();
  assert.ok(records.length > 50);
  assert.ok(records.some((record) => record.sourceKind === "book-catalog" && record.title === "صحيح البخاري"));
  assert.ok(records.some((record) => record.sourceKind === "registry-source"));
  assert.ok(records.some((record) => record.sourceKind === "bibliographic-index"));
});

test("unified metadata search finds a book by title and preserves provenance", () => {
  const records = buildUnifiedSourceRecords();
  const results = searchUnified("صحيح البخاري", records, { corpus: "sunni", requireSource: true });
  const bukhari = results.find((record) => record.title === "صحيح البخاري");
  assert.ok(bukhari);
  assert.equal(bukhari.corpus, "sunni");
  assert.ok(bukhari.source);
  assert.ok(bukhari.author.includes("البخاري"));
  assert.equal(bukhari.sourceKind, "book-catalog");
});
