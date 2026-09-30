import { OmegaHardwareGuardian } from "./omega-hardware-guardian.js";

let generator = null;
let runtimeBackend = "webgpu";
let fallbackChunkSize = 128;
let stopWatchingGpu = null;

function assertLocalModule(url) {
  const parsed = new URL(url, self.location.href);
  if (!["https:", "http:", "file:"].includes(parsed.protocol)) {
    throw new Error("LOCAL_MODEL_MODULE_PROTOCOL_REJECTED");
  }
  if (parsed.protocol !== "file:" && parsed.origin !== self.location.origin) {
    throw new Error("REMOTE_MODEL_MODULE_REJECTED");
  }
}

function resolveGpuDevice(instance) {
  return instance?.gpuDevice || instance?.webgpuDevice || instance?.device || null;
}

function activateWasmFallback(detail) {
  runtimeBackend = "wasm";
  fallbackChunkSize = Math.max(1, Number(detail?.suggested_chunk_size) || Math.floor(fallbackChunkSize / 2) || 1);

  let switched = false;
  try {
    if (typeof generator?.switchBackend === "function") {
      generator.switchBackend("wasm", { chunk_size: fallbackChunkSize, reason: detail?.reason });
      switched = true;
    } else if (typeof generator?.setBackend === "function") {
      generator.setBackend("wasm");
      switched = true;
    } else if (typeof generator?.onBackendLoss === "function") {
      generator.onBackendLoss({ backend: "wasm", chunk_size: fallbackChunkSize, reason: detail?.reason });
      switched = true;
    }
  } catch (error) {
    self.postMessage({
      id: null,
      ok: false,
      type: "backend-switch-error",
      error: String(error?.message ?? error)
    });
  }

  self.postMessage({
    id: null,
    ok: true,
    type: "runtime-fallback",
    backend: "wasm",
    chunk_size: fallbackChunkSize,
    switched,
    reason: String(detail?.reason || "device-lost")
  });
}

function attachGpuGuardian() {
  stopWatchingGpu?.();
  stopWatchingGpu = null;
  const gpuDevice = resolveGpuDevice(generator);
  if (!gpuDevice) return;

  stopWatchingGpu = self.OmegaHardwareGuardian?.watchWebGPUDeviceLoss?.(gpuDevice, {
    initialChunkSize: fallbackChunkSize,
    fallbackToWasmCallback: activateWasmFallback
  }) || null;
}

self.addEventListener("message", async event => {
  const message = event.data ?? {};
  try {
    if (message.type === "init") {
      const moduleUrl = String(message.module_url ?? "");
      assertLocalModule(moduleUrl);
      runtimeBackend = String(message.options?.backend || "webgpu").toLowerCase() === "wasm" ? "wasm" : "webgpu";
      fallbackChunkSize = Math.max(1, Number(message.options?.chunk_size) || 128);
      const module = await import(moduleUrl);
      if (typeof module.createGenerator !== "function") {
        throw new Error("LOCAL_GENERATOR_FACTORY_MISSING");
      }
      generator = await module.createGenerator(message.options ?? {});
      attachGpuGuardian();
      self.postMessage({ id: message.id ?? null, ok: true, type: "ready", backend: runtimeBackend, chunk_size: fallbackChunkSize });
      return;
    }

    if (message.type === "generate") {
      if (!generator || typeof generator.generate !== "function") {
        throw new Error("LOCAL_GENERATOR_NOT_INITIALIZED");
      }
      const request = {
        ...(message.request ?? {}),
        backend: runtimeBackend,
        chunk_size: Math.max(1, Number(message.request?.chunk_size) || fallbackChunkSize)
      };
      const result = await generator.generate(request);
      self.postMessage({ id: message.id ?? null, ok: true, type: "result", backend: runtimeBackend, result });
      return;
    }

    throw new Error("WORKER_MESSAGE_UNSUPPORTED");
  } catch (error) {
    self.postMessage({
      id: message.id ?? null,
      ok: false,
      type: "error",
      error: String(error?.message ?? error)
    });
  }
});
