import test from "node:test";
import assert from "node:assert/strict";
import {
  detectOfflineRuntimeProfile,
  evaluateOfflineModelFit
} from "../src/offline/offline-runtime-profile.js";

test("offline profile selects the smallest known memory cap", async () => {
  const profile = await detectOfflineRuntimeProfile({
    navigatorObject: { deviceMemory: 8, hardwareConcurrency: 8 },
    webGpu: null,
    platformProcessCapBytes: 2 * 1024 ** 3,
    nativeWebViewCapBytes: 3 * 1024 ** 3
  });
  assert.equal(profile.model_memory_budget_bytes, 2 * 1024 ** 3);
  assert.equal(profile.device_memory_is_approximate, true);
});

test("offline model admission includes runtime overhead and reserve", async () => {
  const result = evaluateOfflineModelFit({
    profile: {
      model_memory_budget_bytes: 1000,
      wasm_available: true,
      webgpu_available: true
    },
    artifact: {
      sha256_verified: true,
      revision_verified: true,
      license_verified: true,
      estimated_peak_ram_bytes: 500,
      runtime_overhead_bytes: 100,
      index_peak_ram_bytes: 50,
      tokenizer_runtime_bytes: 50,
      concurrent_buffer_bytes: 50,
      safety_margin_bytes: 100
    },
    reserveBytes: 150
  });
  assert.equal(result.status, "too_large_for_device");
  assert.equal(result.required_runtime_memory_bytes, 1000);
});
