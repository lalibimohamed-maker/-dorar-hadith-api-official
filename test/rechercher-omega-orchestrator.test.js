import test from "node:test";
import assert from "node:assert/strict";
import { loadModelRegistry, buildPlan, createProvenanceRecord, assertOutputBoundary } from "../src/rechercher-omega-orchestrator.js";

test("registry loads with multiple specialized workers", async () => {
  const registry = await loadModelRegistry();
  assert.ok(registry.models.length >= 8);
  assert.ok(registry.models.some(model => model.id === "wan2.2"));
  assert.ok(registry.models.some(model => model.id === "qwen3-omni"));
});

test("media planning selects workers without treating them as evidence", async () => {
  const registry = await loadModelRegistry();
  const plan = buildPlan({
    task: "text_to_video",
    output_kind: "research_media",
    rights_status: "review_required"
  }, registry);

  assert.equal(plan.status, "ready");
  assert.equal(plan.gates.generated_media_is_evidence, false);
  assert.equal(plan.gates.corpus_write_allowed, false);
  assert.ok(plan.models.length > 0);
});

test("scholarly synthesis fails closed without evidence", async () => {
  const registry = await loadModelRegistry();
  const plan = buildPlan({
    task: "evidence_synthesis",
    output_kind: "analysis"
  }, registry);

  assert.equal(plan.status, "blocked");
  assert.match(plan.block_reason, /explicit evidence/);
});

test("public media fails closed until rights are cleared", async () => {
  const registry = await loadModelRegistry();
  const plan = buildPlan({
    task: "text_to_video",
    output_kind: "public_media",
    rights_status: "review_required"
  }, registry);

  assert.equal(plan.status, "blocked");
  assert.match(plan.block_reason, /rights_status=cleared/);
});

test("provenance cannot promote generated media into Corpus", async () => {
  const registry = await loadModelRegistry();
  const plan = buildPlan({
    task: "text_to_video",
    output_kind: "research_media"
  }, registry);
  const provenance = createProvenanceRecord({
    plan,
    source_ids: ["source-561-001"],
    model_versions: ["wan2.2:pending"]
  });

  assert.doesNotThrow(() => assertOutputBoundary({ plan, provenance }));
  assert.equal(provenance.corpus_write, false);
  assert.equal(provenance.generated_media_is_evidence, false);
});


test("council plan includes adversarial and rights review roles", async () => {
  const { buildCouncilPlan } = await import("../src/rechercher-omega-orchestrator.js");
  const plan = buildCouncilPlan({ task: "text_to_video", evidence: [{ source_id: "s1" }], output_kind: "research_media" });
  assert.equal(plan.fail_closed, true);
  assert.ok(plan.roles.includes("contrarian"));
  assert.ok(plan.roles.includes("rights_auditor"));
});

test("model tournament records reproducible evaluation dimensions", async () => {
  const { buildTournamentPlan } = await import("../src/rechercher-omega-orchestrator.js");
  const plan = buildTournamentPlan({
    task: "text_to_video",
    candidate_models: ["wan2.2", "hunyuanvideo-1.5"],
    constraints: { max_vram_mb: 16384 }
  });
  assert.deepEqual(plan.candidates, ["wan2.2", "hunyuanvideo-1.5"]);
  assert.ok(plan.metrics.includes("evidence_fidelity"));
  assert.equal(plan.selection, "benchmark_results_only");
});
