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
