import test from "node:test";
import assert from "node:assert/strict";
import {
  loadGlobalResearchRadar,
  selectResearchProviders,
  buildResearchProbePlan,
  assertResearchRadarBoundary
} from "../src/rechercher-omega-global-research-radar.js";

test("Global Deep Research Radar contains free/no-key and local research paths", async () => {
  const radar = await loadGlobalResearchRadar();
  const ids = radar.providers.map(p => p.id);
  assert.ok(ids.includes("jina-reader"));
  assert.ok(ids.includes("searxng"));
  assert.ok(ids.includes("jina-deepsearch"));
});

test("UI-only deep research is never treated as an automatable provider", async () => {
  const radar = await loadGlobalResearchRadar();
  const plan = selectResearchProviders({
    radar,
    task: "global-research",
    availableProviders: ["jina-deepsearch"],
    freeOnly: true
  });
  assert.equal(plan.status, "queued");
  assert.deepEqual(plan.providers, []);
});

test("free-only radar excludes paid fallback and still allows bounded free-credit providers", async () => {
  const radar = await loadGlobalResearchRadar();
  const plan = selectResearchProviders({
    radar,
    task: "global-research",
    availableProviders: ["jina-reader", "searxng", "brave-search"],
    freeOnly: true,
    allowCreditProviders: true
  });
  assert.deepEqual(plan.providers.map(p => p.id), ["jina-reader", "searxng", "brave-search"]);
  assert.equal(plan.paid_fallback_allowed, false);
});

test("free-only mode can exclude credit-backed APIs", async () => {
  const radar = await loadGlobalResearchRadar();
  const plan = selectResearchProviders({
    radar,
    task: "global-research",
    availableProviders: ["jina-reader", "brave-search"],
    freeOnly: true,
    allowCreditProviders: false
  });
  assert.deepEqual(plan.providers.map(p => p.id), ["jina-reader"]);
});

test("radar health plan is fail-closed and cannot write Corpus", async () => {
  const radar = await loadGlobalResearchRadar();
  const plan = buildResearchProbePlan({
    radar,
    task: "health-check",
    availableProviders: ["jina-reader", "searxng", "brave-search"]
  });
  assert.doesNotThrow(() => assertResearchRadarBoundary(plan));
  assert.equal(plan.network_execution, false);
  assert.equal(plan.corpus_write_allowed, false);
  assert.equal(plan.paid_fallback_allowed, false);
});
