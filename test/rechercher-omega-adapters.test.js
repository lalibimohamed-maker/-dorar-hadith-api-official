import test from "node:test";
import assert from "node:assert/strict";
import { buildAdapterRequest, buildKaggleExecution } from "../src/rechercher-omega-adapters.js";

test("remote adapters never serialize credentials", () => {
  const request = buildAdapterRequest({
    backend: "huggingface-inference",
    model: "openai/gpt-oss-120b",
    input: { messages: [{ role: "user", content: "test" }] }
  });
  assert.equal(request.provider, "huggingface");
  assert.equal("token" in request, false);
  assert.equal("apiKey" in request, false);
});

test("Kaggle adapter produces a remote-kernel execution plan", () => {
  const plan = buildKaggleExecution({
    kernel_slug: "owner/rechercher-omega-worker",
    dataset_refs: ["owner/model-cache"],
    command: "python worker.py"
  });
  assert.equal(plan.backend, "kaggle-gpu");
  assert.equal(plan.mode, "remote_kernel");
  assert.equal(plan.corpus_write_allowed, false);
  assert.equal(plan.generated_media_is_evidence, false);
});

test("Kaggle adapter rejects an implicit command", () => {
  assert.throws(() => buildKaggleExecution({ kernel_slug: "owner/worker" }), /explicit command/);
});

test("adapter boundary rejects Corpus writes", () => {
  assert.throws(
    () => buildAdapterRequest({ backend: "local", model: "qwen3", input: { corpus_write_allowed: true } }),
    /Corpus writes are forbidden/
  );
});
