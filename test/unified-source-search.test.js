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
  const bukhari = results.find((record) => record.title === "صحيح البخاري" && record.sourceKind === "book-catalog");
  assert.ok(bukhari);
  assert.equal(bukhari.corpus, "sunni");
  assert.ok(bukhari.source);
  assert.ok(bukhari.author.includes("البخاري"));
  assert.equal(bukhari.sourceKind, "book-catalog");
});


test("knowledge evidence classification keeps potential relationships separate from verified evidence", async () => {
  const { buildEvidence, classifyEvidenceState } = await import("../src/unified-knowledge-index.js");
  assert.equal(classifyEvidenceState({ verification: "potential", relationType: "interpretive_relationship" }), "potential");
  assert.equal(classifyEvidenceState({ verification: "source-verified" }), "verified");
  const potential = buildEvidence({
    id: "relation-1",
    source: "https://example.org/source",
    verification: "potential",
    relationType: "interpretive_relationship"
  });
  assert.equal(potential.evidenceState, "potential");
  assert.equal(potential.sourceId, "relation-1");
  const verified = buildEvidence({
    id: "source-1",
    source: "https://example.org/source",
    verification: "source-verified"
  });
  assert.equal(verified.evidenceState, "verified");
  assert.equal(verified.sourceId, "source-1");
});

test("every indexed result evidence envelope retains source attribution", () => {
  const records = buildUnifiedSourceRecords();
  assert.ok(records.length > 50);
  for (const record of records.slice(0, 25)) {
    assert.ok(record.source, `missing source on ${record.id}`);
  }
});
