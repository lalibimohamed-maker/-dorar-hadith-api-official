import test from "node:test";
import assert from "node:assert/strict";
import { loadExecutionBackends, selectExecutionBackend, assertExecutionBoundary } from "../src/rechercher-omega-execution-router.js";

test("execution registry contains free-first local, API and GPU paths", async () => {
  const registry = await loadExecutionBackends();
  assert.ok(registry.backends.some(b => b.id === "local"));
  assert.ok(registry.backends.some(b => b.id === "gemini-free-tier"));
  assert.ok(registry.backends.some(b => b.id === "groq-free-plan"));
  assert.ok(registry.backends.some(b => b.id === "huggingface-inference"));
  assert.ok(registry.backends.some(b => b.id === "kaggle-gpu"));
});

test("router prefers local execution when it is available", async () => {
  const registry = await loadExecutionBackends();
  const plan = selectExecutionBackend({
    backends: registry,
    task: "reasoning",
    model: "qwen3",
    availableBackends: ["local", "gemini-free-tier", "groq-free-plan"]
  });
  assert.equal(plan.status, "ready");
  assert.equal(plan.backend, "local");
  assert.equal(plan.free, true);
});

test("router can select a free remote API when local execution is unavailable", async () => {
  const registry = await loadExecutionBackends();
  const plan = selectExecutionBackend({
    backends: registry,
    task: "reasoning",
    model: "qwen3",
    availableBackends: ["gemini-free-tier", "groq-free-plan"]
  });
  assert.equal(plan.status, "ready");
  assert.equal(plan.backend, "gemini-free-tier");
  assert.equal(plan.requires_api_key, true);
});

test("router queues when no eligible backend exists", async () => {
  const registry = await loadExecutionBackends();
  const plan = selectExecutionBackend({
    backends: registry,
    task: "text_to_video",
    model: "wan2.2",
    availableBackends: ["unavailable-backend"]
  });
  assert.equal(plan.status, "ready");
  assert.equal(plan.corpus_write_allowed, false);
});

test("execution boundary remains fail-closed", async () => {
  const registry = await loadExecutionBackends();
  const plan = selectExecutionBackend({
    backends: registry,
    task: "reasoning",
    model: "qwen3",
    availableBackends: ["local"]
  });
  assert.doesNotThrow(() => assertExecutionBoundary(plan));
});
