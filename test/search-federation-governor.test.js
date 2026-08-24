import test from "node:test";
import assert from "node:assert/strict";
import { mergeSearchResults, planFederatedSearch } from "../src/search-federation-governor.js";

test("plans bounded parallel provider jobs", () => {
  const providers = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, enabled: true }));
  const result = planFederatedSearch({ query: "تفسير السعدي", language: "ar", providers });
  assert.equal(result.allowed, true);
  assert.equal(result.strategy, "parallel-federated");
  assert.equal(result.jobs.length, 8);
});

test("disabled providers are excluded", () => {
  const result = planFederatedSearch({ query: "hadith", providers: [{ id: "a", enabled: false }, { id: "b" }] });
  assert.deepEqual(result.jobs.map((job) => job.providerId), ["b"]);
});

test("empty query is blocked", () => {
  const result = planFederatedSearch({ query: "   ", providers: [{ id: "a" }] });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "query_required");
});

test("duplicate search results are merged deterministically", () => {
  const result = mergeSearchResults([
    [{ id: "1", canonicalUrl: "https://a" }, { id: "2", canonicalUrl: "https://b" }],
    [{ id: "3", canonicalUrl: "https://a" }, { id: "4", canonicalUrl: "https://c" }]
  ]);
  assert.deepEqual(result.map((item) => item.id), ["1", "2", "4"]);
});
