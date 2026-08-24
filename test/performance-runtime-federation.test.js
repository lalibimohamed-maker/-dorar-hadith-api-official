import test from "node:test";
import assert from "node:assert/strict";
import { planRuntimeFederation } from "../src/performance-runtime-federation.js";

test("selects healthy runtimes by capability and latency", () => {
  const plan = planRuntimeFederation({
    task: "search",
    runtimes: [
      { id: "slow", capabilities: ["search"], latencyMs: 900 },
      { id: "fast", capabilities: ["search"], latencyMs: 120 },
      { id: "unhealthy", capabilities: ["search"], latencyMs: 20, healthy: false }
    ]
  });
  assert.equal(plan.runtimes[0].id, "fast");
  assert.equal(plan.strategy, "parallel-race-with-cancellation");
  assert.equal(plan.runtimes.length, 2);
});

test("bounds parallel runtimes and execution budget", () => {
  const runtimes = Array.from({ length: 20 }, (_, i) => ({ id: `r-${i}`, capabilities: ["search"], latencyMs: i }));
  const plan = planRuntimeFederation({ task: "search", runtimes, budgetMs: 99999 });
  assert.equal(plan.runtimes.length, 8);
  assert.equal(plan.budgetMs, 1800);
});
