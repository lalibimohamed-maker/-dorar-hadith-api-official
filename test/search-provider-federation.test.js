import test from "node:test";
import assert from "node:assert/strict";
import { planSearchFederation } from "../src/search-provider-federation.js";

test("hadith queries prefer specialist providers", () => {
  const plan = planSearchFederation({
    query: "حديث فضل الصلاة",
    providers: [
      { id: "google", class: "web", latencyMs: 100 },
      { id: "hadith-1", class: "hadith_sources", latencyMs: 400 },
      { id: "bing", class: "web", latencyMs: 50 }
    ]
  });
  assert.equal(plan.domain, "hadith");
  assert.equal(plan.providers[0].id, "hadith-1");
});

test("book queries use book sources before generic web search", () => {
  const plan = planSearchFederation({
    query: "تحميل كتاب ابن تيمية pdf",
    providers: [
      { id: "google", class: "web", latencyMs: 50 },
      { id: "books-1", class: "book_sources", latencyMs: 500 }
    ]
  });
  assert.equal(plan.domain, "books");
  assert.equal(plan.providers[0].id, "books-1");
});

test("disabled providers are excluded and provider count is bounded", () => {
  const providers = Array.from({ length: 15 }, (_, i) => ({ id: `p-${i}`, class: "web", enabled: i !== 2 }));
  const plan = planSearchFederation({ query: "علم", providers });
  assert.equal(plan.providers.length, 10);
  assert.equal(plan.providers.some((p) => p.id === "p-2"), false);
  assert.ok(plan.timeoutMs <= 1800);
});
