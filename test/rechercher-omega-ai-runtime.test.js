import test from "node:test";
import assert from "node:assert/strict";

import { loadAICapabilityRegistry } from "../src/rechercher-omega-ai-capability-registry.js";
import { buildAiExecutionGraph, buildMcpToolPolicy, buildProgrammingGraph, buildVerifiedAiExecutionGraph, loadOmegaEngineActivationRegistry } from "../src/rechercher-omega-ai-runtime.js";

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

test("activation registry exposes only evidence-backed active model engines", async () => {
  const registry = await loadOmegaEngineActivationRegistry();
  assert.equal(registry.policy.failClosed, true);
  assert.equal(registry.states.whisper, "active");
  assert.equal(registry.states.kokoro, "active");
  assert.equal(registry.states.qwen3, "active");
  assert.notEqual(registry.states["hunyuanvideo-1.5"], "active");
});

test("verified execution graph automatically consumes the activation registry", async () => {
  const registry = await loadAICapabilityRegistry();
  const graph = await buildVerifiedAiExecutionGraph(registry, {
    pipeline: "voice",
    availableComponents: ["whisper"]
  });
  const asr = graph.nodes.find(n => n.stage === "whisper");
  assert.ok(asr);
  assert.equal(asr.candidates.some(x => x.id === "whisper" && x.activation_state === "active"), true);

  const gated = await buildVerifiedAiExecutionGraph(registry, {
    pipeline: "voice",
    availableComponents: ["faster-whisper"]
  });
  const blockedAsr = gated.nodes.find(n => n.stage === "faster-whisper");
  assert.ok(blockedAsr);
  assert.equal(blockedAsr.candidates.length, 0);
});

test("Hunyuan cannot become active without unified and GPU evidence", async () => {
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const source = await loadOmegaEngineActivationRegistry();
  assert.notEqual(source.states["hunyuanvideo-1.5"], "active");

  const tmp = await fs.mkdtemp((await os.tmpdir()) + "/dinullah-omega-");
  const file = new URL("file://" + tmp + "/activation.json");
  const raw = JSON.parse(await fs.readFile(new URL("../config/rechercher-omega-engine-activation-2026.json", import.meta.url), "utf8"));
  raw.engines["hunyuanvideo-1.5"].state = "active";
  raw.engines["hunyuanvideo-1.5"].evidence.sha256Inventory = true;
  raw.engines["hunyuanvideo-1.5"].evidence.runtimeInstalled = true;
  raw.engines["hunyuanvideo-1.5"].evidence.smokeTest = "passed";
  raw.engines["hunyuanvideo-1.5"].evidence.capabilityTest = "passed";
  raw.engines["hunyuanvideo-1.5"].evidence.corpusWriteAllowed = false;
  raw.engines["hunyuanvideo-1.5"].evidence.modelPresent = true;
  raw.engines["hunyuanvideo-1.5"].evidence.unification = "pending";
  raw.engines["hunyuanvideo-1.5"].evidence.gpuSmokeTest = "pending";
  await fs.writeFile(file, JSON.stringify(raw), "utf8");
  const loaded = await loadOmegaEngineActivationRegistry(file);
  assert.notEqual(loaded.states["hunyuanvideo-1.5"], "active");
});
