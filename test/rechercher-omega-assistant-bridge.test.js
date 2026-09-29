import test from "node:test";
import assert from "node:assert/strict";
import { runGovernedAssistantTurn } from "../src/rechercher-omega-assistant-bridge.js";

test("governed assistant plan routes scholarly questions through Omega", async () => {
  const result = await runGovernedAssistantTurn({
    query: "ما معنى هذا النص؟",
    evidence: [{ source_id: "src-1", text: "نص موثق" }],
    availableBackends: ["openai-compatible"],
    execute: false
  });
  assert.equal(result.plan.task, "scholarly_answer");
  assert.equal(result.plan.status, "ready");
  assert.equal(result.backend.status, "ready");
  assert.equal(result.backend.backend, "openai-compatible");
  assert.equal(result.gate.corpus_write_allowed, false);
  assert.equal(result.provenance.corpus_write, false);
  assert.equal(result.telemetry.privacy.raw_user_query_recorded, false);
});

test("governed assistant blocks scholarly turns without evidence", async () => {
  const result = await runGovernedAssistantTurn({
    query: "سؤال بلا دليل",
    evidence: [],
    availableBackends: ["openai-compatible"],
    execute: false
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.plan.status, "blocked");
});


test("assistant queues before execution when the resource pool is saturated", async () => {
  const result = await runGovernedAssistantTurn({
    query: "اختبار",
    evidence: [{ source_id: "s1", text: "verified" }],
    availableBackends: ["openai-compatible"],
    execute: true,
    resourcePool: { max_concurrency: 1 },
    currentJobs: 1
  });
  assert.equal(result.status, "queued");
  assert.equal(result.resource_admission.reason, "concurrency_limit");
});

test("assistant can return a deterministic semantic-cache hit", async () => {
  const seed = await runGovernedAssistantTurn({
    query: "اختبار",
    evidence: [{ source_id: "s1", text: "verified" }],
    availableBackends: ["openai-compatible"],
    execute: false
  });
  const cacheEntry = {
    ...seed.cache.entry,
    output_ref: "artifact://cached/1"
  };
  const hit = await runGovernedAssistantTurn({
    query: "اختبار",
    evidence: [{ source_id: "s1", text: "verified" }],
    availableBackends: ["openai-compatible"],
    cacheEntry
  });
  assert.equal(hit.status, "cache_hit");
  assert.equal(hit.cache.hit, true);
  assert.equal(hit.cache.entry.output_ref, "artifact://cached/1");
});
