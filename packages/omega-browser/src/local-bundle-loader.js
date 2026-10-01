const DEFAULT_TIMEOUT_MS = 5000;
const pendingLoads = new Map();

function assertTimeout(value) {
  if (!Number.isFinite(value) || value < 1) throw new RangeError("timeoutMs must be a positive number");
  return Math.min(30000, Math.floor(value));
}

function defaultImport(moduleUrl) {
  return import(moduleUrl);
}

function isSameOriginModule(moduleUrl, locationObject = globalThis.location) {
  const parsed = new URL(String(moduleUrl), locationObject?.href || "http://localhost/");
  if (!["https:", "http:", "file:"].includes(parsed.protocol)) return false;
  if (parsed.protocol === "file:") return true;
  if (!locationObject?.origin) return false;
  return parsed.origin === locationObject.origin;
}

export function preloadLocalBrowserModule(moduleUrl, {
  documentObject = globalThis.document,
  locationObject = globalThis.location
} = {}) {
  if (!isSameOriginModule(moduleUrl, locationObject)) {
    throw new Error("LOCAL_RUNTIME_MODULE_MUST_BE_SAME_ORIGIN");
  }
  if (!documentObject?.head?.appendChild) return false;

  const existing = [...(documentObject.querySelectorAll?.('link[rel="modulepreload"][data-omega-module]') || [])]
    .find(node => node.dataset?.omegaModule === String(moduleUrl));
  if (existing) return true;

  const link = documentObject.createElement("link");
  link.rel = "modulepreload";
  link.href = moduleUrl;
  link.dataset.omegaModule = String(moduleUrl);
  documentObject.head.appendChild(link);
  return true;
}

export async function loadLocalBrowserModule(moduleUrl, {
  timeoutMs = DEFAULT_TIMEOUT_MS,
  importImpl = defaultImport,
  locationObject = globalThis.location
} = {}) {
  if (!isSameOriginModule(moduleUrl, locationObject)) {
    return Object.freeze({ status: "rejected", reason: "LOCAL_RUNTIME_MODULE_MUST_BE_SAME_ORIGIN" });
  }

  const timeout = assertTimeout(timeoutMs);
  if (!pendingLoads.has(moduleUrl)) {
    const promise = Promise.resolve().then(() => importImpl(moduleUrl));
    pendingLoads.set(moduleUrl, promise);
  }

  const pending = pendingLoads.get(moduleUrl);
  let timer;
  const timeoutPromise = new Promise(resolve => {
    timer = setTimeout(() => resolve(Object.freeze({
      status: "timeout",
      reason: "LOCAL_RUNTIME_LOAD_TIMEOUT",
      timeout_ms: timeout
    })), timeout);
  });

  try {
    return await Promise.race([
      pending.then(module => Object.freeze({ status: "ready", module })),
      timeoutPromise
    ]);
  } catch (error) {
    return Object.freeze({
      status: "error",
      reason: "LOCAL_RUNTIME_LOAD_FAILED",
      error
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveLocalRuntime({
  mode = "auto",
  moduleUrl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  importImpl = defaultImport,
  onlineFallback = null,
  locationObject = globalThis.location
} = {}) {
  if (!["auto", "offline_only", "online_only"].includes(mode)) {
    throw new TypeError("unsupported mode: " + mode);
  }

  if (mode === "online_only") {
    if (typeof onlineFallback !== "function") {
      return Object.freeze({ status: "blocked", reason: "ONLINE_RUNTIME_REQUIRED" });
    }
    return Object.freeze({ status: "online", value: await onlineFallback() });
  }

  const local = await loadLocalBrowserModule(moduleUrl, {
    timeoutMs,
    importImpl,
    locationObject
  });

  if (local.status === "ready") return local;
  if (mode === "offline_only") {
    return Object.freeze({ status: "blocked", reason: local.reason || "LOCAL_RUNTIME_UNAVAILABLE", local });
  }

  if (typeof onlineFallback === "function") {
    return Object.freeze({
      status: "online",
      local_failure: local.reason || local.status,
      value: await onlineFallback()
    });
  }

  return Object.freeze({ status: "blocked", reason: local.reason || "LOCAL_RUNTIME_UNAVAILABLE", local });
}

export function clearLocalBrowserModuleCache(moduleUrl = null) {
  if (moduleUrl == null) {
    pendingLoads.clear();
    return;
  }
  pendingLoads.delete(moduleUrl);
}

export const LOCAL_RUNTIME_LOAD_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
