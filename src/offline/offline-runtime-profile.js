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

const DEFAULT_BROWSER_MODEL_BUDGET_FRACTION = 0.35;

function normalizePositiveNumber(value) {
  return Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeSafeNonNegativeInteger(value, fallback = 0) {
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

export async function detectOfflineRuntimeProfile({
  navigatorObject = globalThis.navigator,
  webGpu = globalThis.navigator?.gpu ?? null,
  storage = null,
  platformProcessCapBytes = null,
  nativeWebViewCapBytes = null,
  modelBudgetFraction = DEFAULT_BROWSER_MODEL_BUDGET_FRACTION
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

  const fraction = Number.isFinite(modelBudgetFraction) && modelBudgetFraction > 0 && modelBudgetFraction <= 1
    ? modelBudgetFraction
    : DEFAULT_BROWSER_MODEL_BUDGET_FRACTION;
  const deviceBytes = deviceMemoryGb == null ? null : Math.floor(deviceMemoryGb * 1024 ** 3);
  const deviceModelCapBytes = deviceBytes == null ? null : Math.floor(deviceBytes * fraction);
  const platformCap = normalizeSafeNonNegativeInteger(platformProcessCapBytes, 0) || null;
  const nativeCap = normalizeSafeNonNegativeInteger(nativeWebViewCapBytes, 0) || null;
  const caps = [deviceModelCapBytes, platformCap, nativeCap].filter(value => Number.isSafeInteger(value) && value > 0);
  const effectiveMemoryCapBytes = caps.length ? Math.min(...caps) : null;

  return Object.freeze({
    schema_version: "1.1.0",
    environment: browserLike ? "browser_or_webview" : "unknown",
    wasm_available: wasmAvailable,
    webgpu_available: webgpuAvailable,
    local_inference: localInference,
    device_memory_gb: deviceMemoryGb,
    hardware_concurrency: hardwareConcurrency,
    model_memory_budget_bytes: effectiveMemoryCapBytes,
    device_model_memory_cap_bytes: deviceModelCapBytes,
    platform_process_cap_bytes: platformCap,
    native_webview_cap_bytes: nativeCap,
    memory_budget_fraction: fraction,
    memory_budget_source: "coarse-device-memory-plus-known-platform-caps",
    device_memory_is_approximate: true,
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

  const requiredBytes =
      estimatedPeak
    + normalizeSafeNonNegativeInteger(artifact.runtime_overhead_bytes)
    + normalizeSafeNonNegativeInteger(artifact.index_peak_ram_bytes)
    + normalizeSafeNonNegativeInteger(artifact.tokenizer_runtime_bytes)
    + normalizeSafeNonNegativeInteger(artifact.concurrent_buffer_bytes)
    + normalizeSafeNonNegativeInteger(artifact.safety_margin_bytes)
    + Math.max(0, normalizeSafeNonNegativeInteger(reserveBytes));

  if (!Number.isSafeInteger(requiredBytes)) {
    return Object.freeze({
      status: "blocked",
      reason: "required_runtime_memory_overflow"
    });
  }

  if (profile.model_memory_budget_bytes != null &&
      requiredBytes > profile.model_memory_budget_bytes) {
    return Object.freeze({
      status: "too_large_for_device",
      reason: "required_runtime_memory_exceeds_effective_cap",
      estimated_peak_ram_bytes: estimatedPeak,
      required_runtime_memory_bytes: requiredBytes,
      effective_memory_cap_bytes: profile.model_memory_budget_bytes
    });
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
    estimated_peak_ram_bytes: estimatedPeak,
    required_runtime_memory_bytes: requiredBytes,
    effective_memory_cap_bytes: profile.model_memory_budget_bytes ?? null
  });
}
