import test from "node:test";
import assert from "node:assert/strict";

import { loadAICapabilityRegistry } from "../src/rechercher-omega-ai-capability-registry.js";
import { buildAiExecutionGraph, buildMcpToolPolicy, buildProgrammingGraph } from "../src/rechercher-omega-ai-runtime.js";

test("voice execution graph includes wake, ASR and TTS capability stages", async () => {
  const registry = await loadAICapabilityRegistry();
  const graph = buildAiExecutionGraph(registry, { pipeline: "voice" });
  assert.equal(graph.policy.corpus_write_allowed, false);
  assert.equal(graph.policy.arbitrary_third_party_execution, false);
  assert.ok(graph.nodes.some(n => n.stage === "openwakeword"));
  assert.ok(graph.nodes.some(n => n.stage === "faster-whisper"));
});

test("document execution graph keeps independent OCR candidates", async () => {
  const registry = await loadAICapabilityRegistry();
  const graph = buildAiExecutionGraph(registry, { pipeline: "document" });
  const ocrNodes = graph.nodes.filter(n => ["paddleocr-vl", "deepseek-ocr", "olmocr"].includes(n.stage));
  assert.equal(ocrNodes.length >= 2, true);
  assert.ok(graph.nodes.some(n => n.stage === "docling"));
});

test("MCP tool policy denies credential and arbitrary code access", () => {
  const policy = buildMcpToolPolicy(["source_search", "pdf_inspection"]);
  assert.ok(policy.allow.includes("source_search"));
  assert.ok(policy.deny.includes("credential_read"));
  assert.ok(policy.deny.includes("raw_external_code_execution"));
  assert.equal(policy.audit_required, true);
});

test("programming graph requires tests and scoped changes", async () => {
  const registry = await loadAICapabilityRegistry();
  const graph = buildProgrammingGraph(registry);
  assert.equal(graph.role, "programming");
  assert.equal(graph.code_policy.inspect_before_write, true);
  assert.equal(graph.code_policy.tests_required, true);
  assert.ok(graph.tools.includes("typecheck"));
});

test("model-bearing AI candidates require explicit active runtime state when supplied", async () => {
  const registry = await loadAICapabilityRegistry();
  const blocked = buildAiExecutionGraph(registry, {
    pipeline: "voice",
    activationStates: { "faster-whisper": "blocked", "whisper": "blocked" }
  });
  const asr = blocked.nodes.find(n => n.stage === "faster-whisper");
  assert.ok(asr);
  assert.equal(asr.candidates.length, 0);
  assert.ok(asr.rejected_candidates.some(x => x.id === "faster-whisper"));

  const active = buildAiExecutionGraph(registry, {
    pipeline: "voice",
    activationStates: { "faster-whisper": "active", "whisper": "active" }
  });
  const activeAsr = active.nodes.find(n => n.stage === "faster-whisper");
  assert.ok(activeAsr.candidates.some(x => x.id === "faster-whisper"));
});
