import test from "node:test";
import assert from "node:assert/strict";

import {
  loadAICapabilityRegistry,
  listCapabilities,
  buildPipelinePlan,
  assertAICapabilityBoundary
} from "../src/rechercher-omega-ai-capability-registry.js";

test("AI capability registry keeps secret harvesting and Corpus writes disabled", async () => {
  const registry = await loadAICapabilityRegistry();
  assert.equal(registry.policy.free_first, true);
  assert.equal(registry.policy.secret_harvesting, false);
  assert.equal(registry.policy.public_secret_use, false);
  assert.equal(registry.policy.corpus_write_allowed, false);
  assert.equal(registry.policy.external_code_auto_execution, false);
});

test("registry includes the voice, document, retrieval and agent building blocks", async () => {
  const registry = await loadAICapabilityRegistry();
  for (const id of [
    "openwakeword",
    "silero-vad",
    "faster-whisper",
    "kokoro",
    "cosyvoice",
    "paddleocr-vl",
    "docling",
    "docling-mcp",
    "mineru",
    "olmocr",
    "bge-m3",
    "bge-reranker-v2-m3",
    "qdrant",
    "mcp-python-sdk",
    "hermes-agent",
    "ollama",
    "llama-cpp",
    "gpt-oss",
    "gpt-oss-safeguard",
    "localai",
    "vllm",
    "whisper-cpp",
    "piper",
    "pgvector",
    "bge-vl",
    "pyannote-audio",
    "deepseek-ocr",
    "openvino",
    "markitdown",
    "qwen3-coder",
    "aider",
    "tabby",
    "mini-swe-agent",
    "codex-cli",
    "everos",
    "memoripy",
    "tokensave",
    "roam-code",
    "prismor",
    "agent-inspect",
    "mcp-evals"
  ]) {
    assert.ok(registry.components.some(component => component.id === id), "missing " + id);
  }
});

test("BGE-M3 is registered as a multilingual retrieval worker", async () => {
  const registry = await loadAICapabilityRegistry();
  const bge = registry.components.find(component => component.id === "bge-m3");
  assert.deepEqual(
    bge.tasks,
    ["dense_embedding", "sparse_retrieval", "multi_vector_retrieval", "semantic_search"]
  );
});

test("voice pipeline is local-first and keeps Arabic Quran recitation Arabic", async () => {
  const registry = await loadAICapabilityRegistry();
  const plan = buildPipelinePlan(registry, "voice");
  assert.equal(plan.fail_closed, true);
  assert.ok(plan.components.some(component => component.id === "faster-whisper"));
  assert.ok(plan.components.some(component => component.id === "qwen3-omni"));
  assert.equal(registry.pipelines.voice.canonical_quran_recitation, "arabic_audio_only");
  assert.doesNotThrow(() => assertAICapabilityBoundary(plan));
});

test("document pipeline keeps independent OCR challengers", async () => {
  const registry = await loadAICapabilityRegistry();
  const plan = buildPipelinePlan(registry, "document");
  assert.ok(plan.components.some(component => component.id === "paddleocr-vl"));
  assert.ok(plan.components.some(component => component.id === "olmocr"));
  assert.ok(plan.components.some(component => component.id === "docling"));
  assert.equal(plan.corpus_write_allowed, false);
});

test("task lookup can discover multilingual reranking", async () => {
  const registry = await loadAICapabilityRegistry();
  const rerankers = listCapabilities(registry, "reranking");
  assert.ok(rerankers.some(component => component.id === "bge-reranker-v2-m3"));
});
