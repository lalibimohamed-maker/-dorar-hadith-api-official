import test from "node:test";
import assert from "node:assert/strict";
import {
  createArabicQueryPlan,
  searchWithArabicQueryPlan
} from "../src/offline/arabic-query-normalizer.js";

test("Arabic query plan preserves the original and removes Tatweel as a retrieval-only variant", () => {
  const plan = createArabicQueryPlan("عـلـم");
  assert.equal(plan[0].kind, "original");
  assert.equal(plan.some(item => item.query === "علم"), true);
  assert.equal(plan.some(item => item.kind === "tatweel_removed"), true);
});

test("Arabic query plan adds controlled maqsurah and loose variants without changing source text", () => {
  const plan = createArabicQueryPlan("الهدى");
  assert.equal(plan.some(item => item.kind === "maqsurah_yaa_variant" && item.query === "الهدي"), true);
  assert.equal(plan.some(item => item.kind === "controlled_loose_variant"), true);
});

test("variant search deduplicates evidence by stable node id", async () => {
  const seen = [];
  const result = await searchWithArabicQueryPlan(async (query, meta) => {
    seen.push(meta.query_variant);
    return [{ document: { node_id: "e1", text: query } }, { document: { node_id: "e2", text: query } }];
  }, "عـلـم");
  assert.equal(result.hits.length, 2);
  assert.equal(seen.length >= 2, true);
  assert.equal(result.raw_query, "عـلـم");
});
