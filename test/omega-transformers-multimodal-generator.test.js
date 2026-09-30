import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Transformers.js local generator has a guarded multimodal path", async () => {
  const source = await readFile("src/offline/transformers-js-local-generator.js", "utf8");
  assert.match(source, /omega-visual-pruner\.js/);
  assert.match(source, /omega-multimodal-context-guard\.js/);
  assert.match(source, /task = "text-generation"/);
  assert.match(source, /image-text-to-text/);
  assert.match(source, /local_files_only: true/);
  assert.match(source, /OmegaMultimodalContextGuard\.assertEvidencePreserved/);
  assert.match(source, /OmegaVisualPruner\.plan/);
  assert.match(source, /onBackendLoss/);
  assert.match(source, /switchBackend\("wasm"/);
});

test("multimodal generator rejects non-local URL-shaped image inputs", async () => {
  const source = await readFile("src/offline/transformers-js-local-generator.js", "utf8");
  assert.doesNotMatch(source, /fetch\(/);
  assert.match(source, /LOCAL_MULTIMODAL_IMAGE_RESIZER_UNAVAILABLE/);
});
