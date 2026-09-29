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
