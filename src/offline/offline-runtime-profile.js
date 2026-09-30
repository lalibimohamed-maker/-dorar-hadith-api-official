/**
 * Rechercher Ω — Offline & Local-First runtime profile.
 *
 * Device capability detection is advisory infrastructure selection only.
 * Scholarly correctness remains enforced by the existing evidence/claim gates.
 */

export const OFFLINE_RUNTIME_MODES = Object.freeze([
  "auto",
  "offline_only",
  "online_only"
]);

const DEFAULT_BROWSER_MODEL_MEMORY_FRACTION = 0.35;

function normalizePositiveNumber(value) {
  return Number.isFinite(value) && value > 0 ? value : null;
}

export async function detectOfflineRuntimeProfile({
  navigatorObject = globalThis.navigator,
  webGpu = globalThis.navigator?.gpu ?? null,
  storage = null
} = {}) {
  const deviceMemoryGb = normalizePositiveNumber(
    Number(navigatorObject?.deviceMemory ?? 0)
  );
  const hardwareConcurrency = Number.isInteger(navigatorObject?.hardwareConcurrency)
    ? Math.max(1, navigatorObject.hardwareConcurrency)
    : null;

  let webgpuAvailable = Boolean(webGpu);
  if (webGpu && typeof webGpu.requestAdapter === "function") {
    try {
      webgpuAvailable = Boolean(await webGpu.requestAdapter({ powerPreference: "low-power" }));
    } catch {
      webgpuAvailable = false;
    }
  }

  let storageQuotaBytes = null;
  let storageUsageBytes = null;
  if (storage?.estimate && typeof storage.estimate === "function") {
    try {
      const estimate = await storage.estimate();
      storageQuotaBytes = normalizePositiveNumber(Number(estimate?.quota ?? 0));
      storageUsageBytes = normalizePositiveNumber(Number(estimate?.usage ?? 0));
    } catch {}
  }

  const wasmAvailable = typeof WebAssembly !== "undefined";
  const browserLike = Boolean(navigatorObject);

  let localInference = "unavailable";
  if (wasmAvailable) localInference = "wasm";
  if (webgpuAvailable) localInference = "webgpu";

  const memoryBudgetBytes = deviceMemoryGb == null
    ? null
    : Math.floor(deviceMemoryGb * 1024 ** 3 * DEFAULT_BROWSER_MODEL_MEMORY_FRACTION);

  return Object.freeze({
    schema_version: "1.0.0",
    environment: browserLike ? "browser_or_webview" : "unknown",
    wasm_available: wasmAvailable,
    webgpu_available: webgpuAvailable,
    local_inference: localInference,
    device_memory_gb: deviceMemoryGb,
    hardware_concurrency: hardwareConcurrency,
    model_memory_budget_bytes: memoryBudgetBytes,
    storage_quota_bytes: storageQuotaBytes,
    storage_usage_bytes: storageUsageBytes,
    network_required_for_local_mode: false
  });
}

export function evaluateOfflineModelFit({
  profile,
  artifact = {},
  reserveBytes = 256 * 1024 * 1024
} = {}) {
  if (!profile || typeof profile !== "object") {
    return Object.freeze({ status: "blocked", reason: "runtime_profile_missing" });
  }
  if (!artifact || typeof artifact !== "object") {
    return Object.freeze({ status: "blocked", reason: "model_artifact_missing" });
  }

  if (artifact.sha256_verified !== true ||
      artifact.revision_verified !== true ||
      artifact.license_verified !== true) {
    return Object.freeze({
      status: "blocked",
      reason: "runtime_artifact_not_verified"
    });
  }

  const estimatedPeak = Number(artifact.estimated_peak_ram_bytes ?? 0);
  if (!Number.isSafeInteger(estimatedPeak) || estimatedPeak < 1) {
    return Object.freeze({
      status: "blocked",
      reason: "model_peak_ram_estimate_required"
    });
  }

  if (profile.model_memory_budget_bytes != null) {
    const usable = profile.model_memory_budget_bytes - Math.max(0, reserveBytes);
    if (estimatedPeak > usable) {
      return Object.freeze({
        status: "too_large_for_device",
        reason: "estimated_peak_ram_exceeds_browser_budget",
        estimated_peak_ram_bytes: estimatedPeak,
        usable_model_budget_bytes: usable
      });
    }
  }

  const requestedDevice = String(artifact.execution_device ?? "auto");
  if (requestedDevice === "webgpu" && profile.webgpu_available !== true) {
    return Object.freeze({
      status: "cpu_fallback",
      reason: "webgpu_unavailable"
    });
  }

  if (requestedDevice === "wasm" && profile.wasm_available !== true) {
    return Object.freeze({
      status: "blocked",
      reason: "wasm_unavailable"
    });
  }

  return Object.freeze({
    status: "fit",
    execution_device: requestedDevice === "auto"
      ? (profile.webgpu_available ? "webgpu" : "wasm")
      : requestedDevice,
    estimated_peak_ram_bytes: estimatedPeak
  });
}
