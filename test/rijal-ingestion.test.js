import test from "node:test";
import assert from "node:assert/strict";
import { buildRijalIngestionBatch, listRijalSources } from "../src/rijal-ingestion.js";

test("rijal source catalog includes primary and comparative sources", () => {
  const sources = listRijalSources();
  assert.ok(sources.some((s) => s.id === "bukhari-tarikh-kabir"));
  assert.ok(sources.some((s) => s.id === "ibn-abi-hatim-jarh"));
  assert.ok(sources.some((s) => s.id === "yahya-ibn-main-tarikh"));
  assert.ok(sources.some((s) => s.id === "ibn-hajar-tahdhib"));
});

test("default batch starts with primary sources and never auto-verifies", () => {
  const batch = buildRijalIngestionBatch({ offset: 0, limit: 100 });
  assert.deepEqual(batch.sourceIds, ["bukhari-tarikh-kabir", "ibn-abi-hatim-jarh"]);
  assert.equal(batch.extraction.mode, "source-first");
  assert.equal(batch.extraction.neverInferSilenceAsApproval, true);
  assert.equal(batch.extraction.preserveDisagreement, true);
  assert.equal(batch.noteAr.includes("لا تنشئ أحكامًا"), true);
});

test("specific source can be selected", () => {
  const batch = buildRijalIngestionBatch({ sourceId: "ibn-adi-kamil", limit: 50 });
  assert.deepEqual(batch.sourceIds, ["ibn-adi-kamil"]);
  assert.equal(batch.limit, 50);
});
