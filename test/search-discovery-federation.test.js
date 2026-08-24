import test from "node:test";
import assert from "node:assert/strict";
import { createDiscoveryPlan, normalizeDiscoveryResults, canEnterSourceVerification } from "../src/search-discovery-federation.js";

const providers = [
  { id: "official", class: "official", enabled: true },
  { id: "web1", class: "web", enabled: true }
];

test("normalizes discovery results and keeps provenance", () => {
  const out = normalizeDiscoveryResults([
    { providerId: "official", title: "A", url: "https://example.org/a/" },
    { providerId: "official", title: "A duplicate", url: "https://example.org/a/#x" }
  ], providers);
  assert.equal(out.length, 1);
  assert.equal(out[0].provenance.originalUrl, "https://example.org/a/");
  assert.equal(out[0].rights, "rights-unclear");
  assert.equal(out[0].isDiscoveryOnly, true);
});

test("never upgrades unclear rights during discovery", () => {
  const plan = createDiscoveryPlan({
    query: "كتاب",
    providers,
    results: [{ providerId: "official", title: "Book", url: "https://example.org/book" }]
  });
  assert.equal(plan.results[0].rights, "rights-unclear");
  assert.equal(plan.rule, "discovery-is-not-authority");
});

test("only provenance-bearing discovery records enter source verification", () => {
  assert.equal(canEnterSourceVerification({ url: "https://example.org", provenance: { originalUrl: "https://example.org" }, isDiscoveryOnly: true }), true);
  assert.equal(canEnterSourceVerification({ url: "https://example.org" }), false);
});
