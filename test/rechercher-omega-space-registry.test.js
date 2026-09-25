import test from "node:test";
import assert from "node:assert/strict";
import {
  loadOmegaSpaceRegistry,
  selectOmegaSpaceReferences,
  buildOmegaSpacePlan,
  assertOmegaSpaceBoundary
} from "../src/rechercher-omega-space-registry.js";

test("curated Space registry contains verified useful references", async () => {
  const registry = await loadOmegaSpaceRegistry();
  assert.ok(registry.spaces.length >= 7);
  assert.ok(registry.spaces.some(space => space.space_id === "lfoppiano/document-qa"));
  assert.ok(registry.spaces.some(space => space.space_id === "LovnishVerma/rag"));
  assert.ok(registry.spaces.some(space => space.space_id === "aizip-dev/SLM-RAG-Arena"));
  assert.ok(registry.spaces.some(space => space.space_id === "k2-fsa/OmniVoice"));
});

test("document capabilities resolve only reference Spaces", async () => {
  const registry = await loadOmegaSpaceRegistry();
  const references = selectOmegaSpaceReferences({
    registry,
    capabilities: ["document_qa", "pdf_rag"]
  });
  assert.ok(references.some(space => space.space_id === "lfoppiano/document-qa"));
  assert.ok(references.some(space => space.space_id === "LovnishVerma/rag"));
  assert.ok(references.every(space => space.use === "reference"));
});

test("Arabic speech capability resolves the Lahgtna reference", async () => {
  const registry = await loadOmegaSpaceRegistry();
  const plan = buildOmegaSpacePlan({
    registry,
    capabilities: ["arabic_speech"]
  });
  assert.equal(plan.status, "reference_available");
  assert.ok(plan.references.some(space => space.space_id === "oddadmix/Lahgtna-OmniVoice-Demo"));
  assert.equal(plan.executable, false);
});

test("paused tokenizer Space is excluded by default", async () => {
  const registry = await loadOmegaSpaceRegistry();
  const references = selectOmegaSpaceReferences({
    registry,
    capabilities: ["arabic_token_analysis"]
  });
  assert.equal(references.length, 0);
});

test("Space registry is fail-closed", async () => {
  const registry = await loadOmegaSpaceRegistry();
  const plan = buildOmegaSpacePlan({
    registry,
    capabilities: ["document_qa"]
  });
  assert.doesNotThrow(() => assertOmegaSpaceBoundary(plan));
  assert.equal(plan.corpus_write_allowed, false);
  assert.equal(plan.generated_media_is_evidence, false);
});
