import test from "node:test";
import assert from "node:assert/strict";
import {
  detectOfflineRuntimeProfile,
  evaluateOfflineModelFit
} from "../src/offline/offline-runtime-profile.js";
import { normalizeArabicQuery, buildArabicQueryVariants } from "../src/offline/arabic-query-normalizer.js";

test("offline profile detects WASM and WebGPU without requiring a network", async () => {
  const profile = await detectOfflineRuntimeProfile({
    navigatorObject: {
      deviceMemory: 4,
      hardwareConcurrency: 8
    },
    webGpu: null
  });
  assert.equal(profile.wasm_available, true);
  assert.equal(profile.webgpu_available, false);
  assert.equal(profile.device_memory_gb, 4);
  assert.equal(profile.network_required_for_local_mode, false);
});

test("offline model fit uses estimated peak RAM rather than file size", () => {
  const result = evaluateOfflineModelFit({
    profile: {
      model_memory_budget_bytes: 2 * 1024 * 1024 * 1024,
      wasm_available: true,
      webgpu_available: true
    },
    artifact: {
      sha256_verified: true,
      revision_verified: true,
      license_verified: true,
      estimated_peak_ram_bytes: 1024 * 1024 * 1024,
      file_size_bytes: 128 * 1024 * 1024
    }
  });
  assert.equal(result.status, "fit");
});

test("Arabic normalization is retrieval-only and preserves the original query", () => {
  assert.equal(normalizeArabicQuery("إِنَّمَا   الأَعْمَالُ"), "انما الاعمال");
  assert.deepEqual(
    buildArabicQueryVariants("إِنَّمَا الأَعْمَالُ"),
    ["إِنَّمَا الأَعْمَالُ", "انما الاعمال"]
  );
});
