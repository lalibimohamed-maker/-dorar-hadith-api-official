import test from "node:test";
import assert from "node:assert/strict";
import { planSearchFederation } from "../src/search-provider-federation.js";

test("hadith queries prefer specialist providers", () => {
  const plan = planSearchFederation({
    query: "حديث فضل الصلاة",
    providers: [
      { id: "google", class: "web", latencyMs: 100 },
      { id: "hadith_sources", class: "hadith_sources", latencyMs: 400 },
      { id: "bing", class: "web", latencyMs: 50 }
    ]
  });
  assert.equal(plan.domain, "hadith");
  assert.equal(plan.providers[0].id, "hadith_sources");
});

test("book queries use book sources before generic web search", () => {
  const plan = planSearchFederation({
    query: "تحميل كتاب ابن تيمية pdf",
    providers: [
      { id: "google", class: "web", latencyMs: 50 },
      { id: "book_sources", class: "book_sources", latencyMs: 500 }
    ]
  });
  assert.equal(plan.domain, "books");
  assert.equal(plan.providers[0].id, "book_sources");
});

test("disabled providers are excluded and provider count is bounded", () => {
  const providers = Array.from({ length: 15 }, (_, i) => ({ id: `p-${i}`, class: "web", enabled: i !== 2 }));
  const plan = planSearchFederation({ query: "علم", providers });
  assert.equal(plan.providers.length, 8);
  assert.equal(plan.providers.some((p) => p.id === "p-2"), false);
  assert.ok(plan.timeoutMs <= 1200);
});


test("web provider candidates are limited to declared official-interface integrations", async () => {
  const { listProviderNetwork, validateProviderDefinition } = await import("../src/search-provider-federation.js");
  const web = listProviderNetwork({ domain: "web" });
  assert.ok(web.some((provider) => provider.id === "google"));
  assert.ok(web.some((provider) => provider.id === "bing"));
  assert.ok(web.some((provider) => provider.id === "brave"));
  assert.ok(web.some((provider) => provider.id === "mojeek"));
  assert.ok(web.some((provider) => provider.id === "duckduckgo"));
  assert.ok(web.some((provider) => provider.id === "yandex"));
  assert.equal(validateProviderDefinition({ id: "brave", enabled: true }).ok, true);
  assert.equal(validateProviderDefinition({ id: "unknown", enabled: true }).ok, false);
  assert.equal(validateProviderDefinition({ id: "brave", enabled: true, scrape: true }).ok, true);
});

test("specialized domains route before generic web providers", () => {
  const plan = planSearchFederation({
    query: "كتاب صحيح البخاري pdf",
    providers: [
      { id: "google", class: "web", latencyMs: 20 },
      { id: "book_sources", class: "book_sources", latencyMs: 100 }
    ]
  });
  assert.equal(plan.domain, "books");
  assert.equal(plan.providers[0].id, "book_sources");
  assert.equal(plan.routing.specializedFirst, true);
  assert.equal(plan.routing.fallbackToWeb, true);
  assert.equal(plan.routing.noScraping, true);
  assert.equal(plan.routing.officialInterfaceOnly, true);
});
