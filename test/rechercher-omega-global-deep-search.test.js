import test from "node:test";
import assert from "node:assert/strict";
import { buildGlobalDeepSearchPlan, generateAIAugmentedSearchPlan, assertGlobalDeepSearchBoundary } from "../src/rechercher-omega-global-deep-search.js";

test("worldwide deep search spans configured languages and registered countries", async () => {
  const plan = await buildGlobalDeepSearchPlan({
    title: "Kitab al-Tawhid",
    author: "Muhammad ibn Abd al-Wahhab",
    maxQueries: 120
  });
  assert.ok(plan.languages_considered.length >= 20);
  assert.ok(plan.countries_considered.length >= 1);
  assert.ok(plan.queries.length > 0);
  assert.doesNotThrow(() => assertGlobalDeepSearchBoundary(plan));
});

test("AI augmentation cannot invent URLs or bypass rights/evidence gates", async () => {
  const plan = await generateAIAugmentedSearchPlan({
    title: "Example scholarly work",
    author: "Example Author",
    maxQueries: 12,
    provider: {
      id: "fixture-ai",
      model: "fixture",
      generate: async () => ({
        provider: "fixture-ai",
        model: "fixture",
        text: JSON.stringify([
          "example scholarly work pdf Arabic",
          "example scholarly work national library Turkey"
        ])
      })
    }
  });
  assert.equal(plan.ai_augmented_queries.length, 2);
  assert.equal(plan.ai_augmented_queries[0].source_family, "ai_augmented_discovery");
  assert.doesNotThrow(() => assertGlobalDeepSearchBoundary(plan));
});

test("malformed AI output is safely discarded", async () => {
  const plan = await generateAIAugmentedSearchPlan({
    title: "Example",
    provider: { generate: async () => ({ text: "not-json" }) }
  });
  assert.deepEqual(plan.ai_augmented_queries, []);
});

test("boundary rejects a promoted discovery query", async () => {
  const plan = await buildGlobalDeepSearchPlan({ title: "Example", maxQueries: 2 });
  plan.queries[0].discovery_only = false;
  assert.throws(() => assertGlobalDeepSearchBoundary(plan), /boundaries/);
});
