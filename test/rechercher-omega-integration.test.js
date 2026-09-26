import test from "node:test";
import assert from "node:assert/strict";

import { loadOmegaSpaceRegistry, buildOmegaSpacePlan } from "../src/rechercher-omega-space-registry.js";
import { buildAdapterRequest } from "../src/rechercher-omega-adapters.js";
import {
  loadModelRegistry,
  buildPlan,
  createProvenanceRecord,
  assertOutputBoundary
} from "../src/rechercher-omega-orchestrator.js";

test("Rechercher Ω keeps source reference → adapter → model → provenance → validation fail-closed", async () => {
  const spaces = await loadOmegaSpaceRegistry();
  const spacePlan = buildOmegaSpacePlan({
    registry: spaces,
    capabilities: ["document_parsing", "ocr", "layout"]
  });

  assert.equal(spacePlan.executable, false);
  const source = spacePlan.references.find(
    item => item.space_id === "PaddlePaddle/PaddleOCR-VL_Online_Demo"
  );
  assert.ok(source);

  const adapter = buildAdapterRequest({
    backend: "local",
    model: "paddleocr-vl",
    input: {
      source_ref: source.space_id,
      source_url: source.url,
      corpus_write_allowed: false
    }
  });

  assert.equal(adapter.provider, "local");
  assert.equal(adapter.input.corpus_write_allowed, false);

  const registry = await loadModelRegistry();
  const plan = buildPlan({
    task: "document_understanding",
    evidence: [{ source_id: source.space_id, hash: "sha256:test-source" }],
    output_kind: "analysis",
    rights_status: "cleared",
    requested_models: ["paddleocr-vl"]
  }, registry);

  assert.equal(plan.status, "ready");

  const provenance = createProvenanceRecord({
    plan,
    source_ids: [source.space_id],
    input_sha256: "sha256:test-source",
    output_sha256: "sha256:test-output",
    model_versions: ["paddleocr-vl@7fa00a8c55b735ba51ba49a9058f3f9c57a99a11"]
  });

  assert.doesNotThrow(() => assertOutputBoundary({ plan, provenance }));
  assert.equal(provenance.corpus_write, false);
  assert.equal(provenance.generated_media_is_evidence, false);
});


test("Starter engine acquisition pins immutable full SHAs and stays review-only", async () => {
  const { readFile } = await import("node:fs/promises");
  const profile = JSON.parse(await readFile(
    new URL("../config/rechercher-omega-engine-acquisition.json", import.meta.url),
    "utf8"
  ));
  assert.equal(profile.policy.corpus_write_allowed, false);
  assert.equal(profile.policy.immutable_revision_required, true);
  for (const engine of profile.engines) {
    assert.match(engine.revision, /^[0-9a-f]{40}$/);
    assert.equal(engine.license_status, "verified_source_license");
    assert.equal(engine.acquisition, "artifact");
  }
});


test("expanded engine fleet keeps heavyweight models out of automatic acquisition", async () => {
  const { readFile } = await import("node:fs/promises");
  const registry = JSON.parse(await readFile(
    new URL("../config/rechercher-omega-model-registry.json", import.meta.url), "utf8"
  ));
  const acquisition = JSON.parse(await readFile(
    new URL("../config/rechercher-omega-engine-acquisition.json", import.meta.url), "utf8"
  ));

  const ids = new Set(registry.models.map(model => model.id));
  for (const required of ["qwen3", "qwen3-vl", "qwen3-omni", "paddleocr-vl", "whisper", "cosyvoice", "wan2.2", "hunyuanvideo-1.5", "ltx-2", "cogvideox", "flux", "sglang"]) {
    assert.ok(ids.has(required), "missing canonical engine " + required);
  }

  const acquired = new Set(acquisition.engines.map(engine => engine.logical_id));
  assert.deepEqual([...acquired].sort(), ["paddleocr-vl", "qwen3", "whisper-tiny"].sort());

  const omni = registry.models.find(model => model.id === "qwen3-omni");
  assert.equal(omni.resource_class, "xlarge");
  assert.equal(omni.approximate_size_gb, 70.5);
});
