import { planOrchestration } from "./orchestration-kernel.js";

export const PERFORMANCE_DEFAULTS = Object.freeze({
  interactiveBudgetMs: 1800,
  maxParallelAdapters: 8,
  searchCancelSlow: true,
  downloadChunkBytes: 8 * 1024 * 1024,
  ocrWorkerConcurrency: 4,
  voiceQueueConcurrency: 2,
  cacheMaxEntries: 256,
});

const TASKS = Object.freeze({
  search: { governanceAction: "discover", interactive: true, race: true },
  reader: { governanceAction: "read", interactive: true, race: false },
  download: { governanceAction: "read", interactive: false, race: false },
  voice: { governanceAction: "transform", interactive: true, race: false },
  video: { governanceAction: "transform", interactive: false, race: false },
  ocr: { governanceAction: "transform", interactive: false, race: false },
});

function taskSpec(task) {
  const spec = TASKS[String(task || "").toLowerCase()];
  if (!spec) throw new Error(`Unsupported performance task: ${task}`);
  return spec;
}

export function buildPerformancePolicy(task, overrides = {}) {
  const spec = taskSpec(task);
  const budgetMs = Number.isFinite(overrides.budgetMs)
    ? Math.max(1, Math.floor(overrides.budgetMs))
    : PERFORMANCE_DEFAULTS.interactiveBudgetMs;
  const maxParallel = Number.isFinite(overrides.maxParallel)
    ? Math.min(PERFORMANCE_DEFAULTS.maxParallelAdapters, Math.max(1, Math.floor(overrides.maxParallel)))
    : PERFORMANCE_DEFAULTS.maxParallelAdapters;

  return Object.freeze({
    task: String(task).toLowerCase(),
    governanceAction: spec.governanceAction,
    interactiveBudgetMs: budgetMs,
    maxParallelAdapters: maxParallel,
    cancelSlow: overrides.cancelSlow ?? spec.race ?? false,
    race: overrides.race ?? spec.race,
  });
}

export function validatePerformanceRequest({ task, provenance, validation, rights, overrides } = {}) {
  const policy = buildPerformancePolicy(task, overrides);
  const operation = {
    action: policy.governanceAction,
    provenance,
    validation,
    rights,
  };
  const governance = planOrchestration(operation);
  return Object.freeze({ policy, governance });
}

function measuredBenchmark(adapter) {
  const benchmark = adapter?.benchmark;
  if (!benchmark || !Number.isFinite(benchmark.throughput) ||
      !Number.isFinite(benchmark.p95LatencyMs) ||
      !Number.isFinite(benchmark.memoryMb)) {
    return null;
  }
  return {
    throughput: Math.max(0, benchmark.throughput),
    p95LatencyMs: Math.max(0, benchmark.p95LatencyMs),
    memoryMb: Math.max(0, benchmark.memoryMb),
    cost: Number.isFinite(benchmark.cost) ? Math.max(0, benchmark.cost) : 0,
  };
}

/**
 * Runtime choice is evidence-driven. Health is a gate; benchmark measurements
 * drive ordering. Runtime names are never used as a proxy for performance.
 */
export function rankRuntimes(adapters = []) {
  return adapters
    .filter(adapter => adapter?.healthy !== false && measuredBenchmark(adapter))
    .map(adapter => ({ ...adapter, benchmark: measuredBenchmark(adapter) }))
    .sort((a, b) => {
      const aa = a.benchmark;
      const bb = b.benchmark;
      if (aa.p95LatencyMs !== bb.p95LatencyMs) return aa.p95LatencyMs - bb.p95LatencyMs;
      if (aa.throughput !== bb.throughput) return bb.throughput - aa.throughput;
      if (aa.memoryMb !== bb.memoryMb) return aa.memoryMb - bb.memoryMb;
      return aa.cost - bb.cost;
    });
}

function limitAdapters(adapters, maxParallelAdapters) {
  return rankRuntimes(adapters).slice(0, maxParallelAdapters);
}

export function createResultCache(maxEntries = PERFORMANCE_DEFAULTS.cacheMaxEntries) {
  const store = new Map();
  const cap = Math.max(1, Math.floor(maxEntries));

  return Object.freeze({
    get(key) {
      if (!store.has(key)) return undefined;
      const value = store.get(key);
      store.delete(key);
      store.set(key, value);
      return value;
    },
    set(key, value) {
      if (store.has(key)) store.delete(key);
      store.set(key, value);
      while (store.size > cap) store.delete(store.keys().next().value);
      return value;
    },
    has: key => store.has(key),
    clear: () => store.clear(),
    size: () => store.size,
  });
}

export function cacheKey(task, input) {
  return `${String(task)}:${typeof input === "string" ? input : JSON.stringify(input ?? null)}`;
}

export async function runParallelAdapters(
  adapters,
  execute,
  { maxParallelAdapters = PERFORMANCE_DEFAULTS.maxParallelAdapters, accept = value => value != null } = {},
) {
  const selected = limitAdapters(adapters, maxParallelAdapters);
  if (!selected.length) throw new Error("No healthy benchmarked adapters are available");

  const controller = new AbortController();
  let accepted = null;
  let settled = 0;
  const results = [];

  await new Promise((resolve, reject) => {
    const finish = () => {
      if (accepted !== null) {
        controller.abort("accepted-result");
        resolve();
      } else if (settled === selected.length) {
        const error = new Error("All adapters completed without an acceptable result");
        error.results = results;
        reject(error);
      }
    };

    selected.forEach((adapter, index) => {
      Promise.resolve()
        .then(() => execute(adapter, { signal: controller.signal, index }))
        .then(value => {
          results[index] = { adapter: adapter.id, value };
          settled += 1;
          if (accepted === null && accept(value)) {
            accepted = { adapter: adapter.id, value };
          }
          finish();
        })
        .catch(error => {
          results[index] = { adapter: adapter.id, error };
          settled += 1;
          finish();
        });
    });
  });

  return accepted;
}

export async function runSearchFastPath({
  adapters,
  execute,
  accept,
  provenance,
  budgetMs = PERFORMANCE_DEFAULTS.interactiveBudgetMs,
  maxParallelAdapters = PERFORMANCE_DEFAULTS.maxParallelAdapters,
} = {}) {
  validatePerformanceRequest({ task: "search", provenance });
  const policy = buildPerformancePolicy("search", { budgetMs, maxParallelAdapters });
  const timer = setTimeout(() => {}, policy.interactiveBudgetMs);
  try {
    return await runParallelAdapters(adapters, execute, {
      maxParallelAdapters: policy.maxParallelAdapters,
      accept: accept ?? (value => Boolean(value?.acceptable ?? value)),
    });
  } finally {
    clearTimeout(timer);
  }
}

export function readerRequest(url, { start = 0, end, headers = {} } = {}) {
  if (!url || typeof url !== "string") throw new TypeError("reader url is required");
  const requestHeaders = { ...headers };
  if (Number.isInteger(start) && start >= 0) {
    requestHeaders.Range = Number.isInteger(end) && end >= start
      ? `bytes=${start}-${end}`
      : `bytes=${start}-`;
  }
  return {
    url,
    headers: requestHeaders,
    cache: "force-cache",
    delivery: "stream-or-range",
  };
}

export function downloadRangeRequest(url, { start = 0, end, chunkBytes = PERFORMANCE_DEFAULTS.downloadChunkBytes, headers = {} } = {}) {
  if (!url || typeof url !== "string") throw new TypeError("download url is required");
  if (!Number.isInteger(start) || start < 0) throw new TypeError("download start must be a non-negative integer");
  const finalEnd = Number.isInteger(end) ? end : start + Math.max(1, chunkBytes) - 1;
  if (finalEnd < start) throw new RangeError("download end must not precede start");
  return {
    url,
    headers: { ...headers, Range: `bytes=${start}-${finalEnd}` },
    resume: start > 0,
    chunkBytes: finalEnd - start + 1,
  };
}

export function nextDownloadRange({ receivedBytes = 0, totalBytes, chunkBytes = PERFORMANCE_DEFAULTS.downloadChunkBytes } = {}) {
  if (!Number.isInteger(receivedBytes) || receivedBytes < 0) throw new TypeError("receivedBytes must be a non-negative integer");
  if (!Number.isInteger(totalBytes) || totalBytes < 1) throw new TypeError("totalBytes must be a positive integer");
  if (!Number.isInteger(chunkBytes) || chunkBytes < 1) throw new TypeError("chunkBytes must be a positive integer");
  if (receivedBytes >= totalBytes) return null;
  return {
    start: receivedBytes,
    end: Math.min(totalBytes - 1, receivedBytes + chunkBytes - 1),
  };
}

export function createVoiceQueue({ concurrency = PERFORMANCE_DEFAULTS.voiceQueueConcurrency, cache = createResultCache() } = {}) {
  const max = Math.max(1, Math.floor(concurrency));
  let active = 0;
  const queue = [];

  const pump = () => {
    while (active < max && queue.length) {
      const item = queue.shift();
      active += 1;
      Promise.resolve()
        .then(item.run)
        .then(value => {
          item.resolve(value);
          item.finally?.();
        }, error => item.reject(error))
        .finally(() => {
          active -= 1;
          pump();
        });
    }
  };

  return Object.freeze({
    submit(key, run) {
      if (cache.has(key)) return Promise.resolve(cache.get(key));
      return new Promise((resolve, reject) => {
        queue.push({
          run: async () => {
            if (cache.has(key)) return cache.get(key);
            const value = await run();
            cache.set(key, value);
            return value;
          },
          resolve,
          reject,
        });
        pump();
      });
    },
    pending: () => queue.length,
    active: () => active,
  });
}

export function buildVideoPipeline({
  source,
  sourceResolutions = [],
  targetResolutions = [360, 480, 720, 1080, 2160],
  streaming = "adaptive",
  codec = "provider-defined",
} = {}) {
  if (!source) throw new Error("video source is required");
  const available = new Set(sourceResolutions.map(Number).filter(Number.isFinite));
  const variants = targetResolutions
    .map(Number)
    .filter(Number.isFinite)
    .filter(height => !available.size || available.has(height) || height <= Math.max(...available))
    .map(height => ({
      height,
      codec,
      adaptive: true,
    }));

  return {
    source,
    streaming,
    variants,
    note: "4K is conditional on source, encoder, hardware and network capability; no speed guarantee is implied.",
  };
}

export async function runWorkerPool(items, worker, { concurrency = PERFORMANCE_DEFAULTS.ocrWorkerConcurrency } = {}) {
  const list = Array.from(items ?? []);
  if (!list.length) return [];
  const limit = Math.max(1, Math.min(PERFORMANCE_DEFAULTS.maxParallelAdapters, Math.floor(concurrency)));
  const results = new Array(list.length);
  let cursor = 0;

  async function runner() {
    while (true) {
      const index = cursor++;
      if (index >= list.length) return;
      results[index] = await worker(list[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, runner));
  return results;
}

export function performanceMetrics({ startedAt, finishedAt, throughput, memoryMb, cacheHit = false } = {}) {
  const durationMs = Math.max(0, Number(finishedAt) - Number(startedAt));
  return Object.freeze({
    durationMs,
    throughput: Number.isFinite(throughput) ? throughput : 0,
    memoryMb: Number.isFinite(memoryMb) ? memoryMb : 0,
    cacheHit: Boolean(cacheHit),
    p95LatencyMs: durationMs,
  });
}

export function routePerformanceTask({ task, adapters, provenance, overrides = {} } = {}) {
  const spec = taskSpec(task);
  const validation = validatePerformanceRequest({ task, provenance, overrides });
  const ranked = limitAdapters(adapters, validation.policy.maxParallelAdapters);
  return Object.freeze({
    task: spec,
    policy: validation.policy,
    governance: validation.governance,
    adapters: ranked.map(adapter => adapter.id),
    execution: spec.race ? "parallel-race" : "selected-runtime-or-worker-pool",
  });
}
