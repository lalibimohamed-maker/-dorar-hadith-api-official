import test from "node:test";
import assert from "node:assert/strict";
import { OfflineIslamicAIEngine } from "../src/offline/offline-governed-engine.js";
import { evaluateOfflineModelFit } from "../src/offline/offline-runtime-profile.js";
import { sha256 } from "../src/rechercher-omega-redis-memory.js";

const source = {
  source_id: "fixture-offline-1",
  citation: "bukhari|1|1",
  kind: "primary_text",
  exact_quote_required: true,
  text: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ",
  text_hash: sha256("إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ"),
  provenance: { source: "fixture", citation: "bukhari|1|1" },
  verification_status: "verified"
};

const artifact = {
  sha256_verified: true,
  revision_verified: true,
  license_verified: true,
  estimated_peak_ram_bytes: 512 * 1024 * 1024,
  execution_device: "wasm"
};

test("offline runtime fit blocks an unverified or oversized model", () => {
  assert.equal(
    evaluateOfflineModelFit({
      profile: {
        model_memory_budget_bytes: 1024 * 1024 * 1024,
        wasm_available: true,
        webgpu_available: false
      },
      artifact: { ...artifact, sha256_verified: false }
    }).status,
    "blocked"
  );

  assert.equal(
    evaluateOfflineModelFit({
      profile: {
        model_memory_budget_bytes: 512 * 1024 * 1024,
        wasm_available: true,
        webgpu_available: false
      },
      artifact
    }).status,
    "too_large_for_device"
  );
});

test("offline engine returns exact Corpus fallback when local model output is rejected", async () => {
  const engine = new OfflineIslamicAIEngine({
    mode: "offline_only",
    localSearch: { async searchLocal() { return [source]; } },
    localGenerator: { async generate() { return "إنما الأعمال بالنية."; } },
    capabilityDetector: async () => ({
      wasm_available: true,
      webgpu_available: false,
      model_memory_budget_bytes: 2 * 1024 * 1024 * 1024
    }),
    modelArtifact: artifact
  });

  const result = await engine.executeTurn("ما نص الحديث؟");
  assert.equal(result.mode, "offline-fallback");
  assert.equal(result.output, source.text);
  assert.equal(result.verification.verified, false);
  assert.equal(result.corpus_write_allowed, false);
});

test("offline engine accepts an exact source-backed local output", async () => {
  const engine = new OfflineIslamicAIEngine({
    mode: "offline_only",
    localSearch: { async searchLocal() { return [source]; } },
    localGenerator: { async generate() { return "النص: " + source.text; } },
    capabilityDetector: async () => ({
      wasm_available: true,
      webgpu_available: false,
      model_memory_budget_bytes: 2 * 1024 * 1024 * 1024
    }),
    modelArtifact: artifact
  });

  const result = await engine.executeTurn("ما نص الحديث؟");
  assert.equal(result.mode, "offline-pure");
  assert.equal(result.output, "النص: " + source.text);
  assert.equal(result.verification.verified, true);
});

test("auto mode uses Online as an explicit fallback when local fit is rejected", async () => {
  const engine = new OfflineIslamicAIEngine({
    mode: "auto",
    localSearch: { async searchLocal() { return [source]; } },
    localGenerator: { async generate() { throw new Error("should not execute"); } },
    onlineRunner: async query => ({ output: "online:" + query }),
    capabilityDetector: async () => ({
      wasm_available: true,
      webgpu_available: false,
      model_memory_budget_bytes: 256 * 1024 * 1024
    }),
    modelArtifact: artifact
  });

  const result = await engine.executeTurn("اختبار");
  assert.equal(result.mode, "online-fallback");
  assert.equal(result.output, "online:اختبار");
});
