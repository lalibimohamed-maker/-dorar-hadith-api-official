const DEFAULT_TIMEOUT_MS = 1200;
const MAX_CONCURRENT = 8;
const DEFAULT_CACHE_TTL_MS = 30_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("ar")
    .replace(/\s+/g, " ");
}

function cacheKey(providerId, query, locale) {
  return `${providerId}::${locale || "ar"}::${normalizeKey(query)}`;
}

async function withTimeout(task, timeoutMs, signal) {
  const controller = new AbortController();
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error("provider-timeout")), timeoutMs);
  try {
    return await Promise.race([
      Promise.resolve().then(() => task(controller.signal)),
      new Promise((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          reject(controller.signal.reason || new Error("provider-timeout"));
        }, { once: true });
      })
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export const PARALLEL_SEARCH_LIMITS = Object.freeze({
  maxConcurrent: MAX_CONCURRENT,
  defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
  defaultCacheTtlMs: DEFAULT_CACHE_TTL_MS
});

export function resolveSearchLanguage(responseLocale = "ar") {
  const locale = String(responseLocale || "ar").trim().toLowerCase() || "ar";
  return Object.freeze({
    requested: responseLocale,
    resolved: locale,
    sourceLanguageResolution: "request-locale"
  });
}

export async function runParallelSearchProviders({
  query,
  locale = "ar",
  jobs = [],
  signal,
  maxConcurrent = MAX_CONCURRENT,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  cache,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  retries = 0
} = {}) {
  if (!Array.isArray(jobs)) throw new TypeError("jobs must be an array");
  const limit = Math.max(1, Math.min(Number(maxConcurrent) || MAX_CONCURRENT, MAX_CONCURRENT));
  const timeout = Math.max(250, Math.min(Number(timeoutMs) || DEFAULT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS));
  const cacheStore = cache && typeof cache.get === "function" && typeof cache.set === "function" ? cache : null;
  const results = new Array(jobs.length);
  let cursor = 0;

  async function runOne(index) {
    const job = jobs[index];
    const providerId = String(job?.id || `provider-${index}`);
    const startedAt = Date.now();
    const key = cacheKey(providerId, query, locale);

    if (cacheStore) {
      const cached = cacheStore.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        results[index] = {
          providerId,
          status: "cached",
          value: cached.value,
          latencyMs: Date.now() - startedAt
        };
        return;
      }
      if (cached) cacheStore.delete(key);
    }

    let attempt = 0;
    while (true) {
      attempt += 1;
      try {
        const value = await withTimeout((providerSignal) => {
          if (signal?.aborted) throw signal.reason || new Error("search-aborted");
          if (typeof job.run !== "function") throw new TypeError(`provider ${providerId} has no run function`);
          return job.run({ query, locale, signal: providerSignal, providerId });
        }, timeout, signal);

        if (cacheStore) {
          cacheStore.set(key, { value, expiresAt: Date.now() + Math.max(0, cacheTtlMs) });
        }
        results[index] = {
          providerId,
          status: "success",
          value,
          attempts: attempt,
          latencyMs: Date.now() - startedAt
        };
        return;
      } catch (error) {
        const isFinal = attempt > retries || signal?.aborted;
        if (!isFinal) {
          await sleep(Math.min(100 * attempt, 250));
          continue;
        }
        results[index] = {
          providerId,
          status: signal?.aborted ? "aborted" : error?.message === "provider-timeout" ? "timeout" : "failed",
          value: null,
          error: String(error?.message || error),
          attempts: attempt,
          latencyMs: Date.now() - startedAt
        };
        return;
      }
    }
  }

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= jobs.length) return;
      await runOne(index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, () => worker()));
  return Object.freeze({
    query,
    locale,
    concurrencyLimit: limit,
    timeoutMs: timeout,
    totalJobs: jobs.length,
    completedJobs: results.filter((item) => ["success", "cached"].includes(item.status)).length,
    degradedJobs: results.filter((item) => !["success", "cached"].includes(item.status)).length,
    results
  });
}

export function deduplicateSearchRecords(records = []) {
  const seen = new Map();
  for (const raw of records) {
    if (!raw || typeof raw !== "object") continue;
    const url = normalizeKey(raw.url || raw.source || "");
    const sourceId = normalizeKey(raw.sourceId || raw.id || "");
    const title = normalizeKey(raw.title || raw.work || "");
    const key = url ? `url:${url}` : sourceId ? `id:${sourceId}` : title ? `title:${title}` : null;
    if (!key) continue;
    const previous = seen.get(key);
    if (!previous) {
      seen.set(key, raw);
      continue;
    }
    const previousScore = Number(previous.relevance || 0);
    const currentScore = Number(raw.relevance || 0);
    if (currentScore > previousScore || (!previous.source && raw.source)) seen.set(key, raw);
  }
  return [...seen.values()];
}

export function createSearchCache() {
  const store = new Map();
  return Object.freeze({
    get(key) { return store.get(key); },
    set(key, value) { store.set(key, value); },
    delete(key) { store.delete(key); },
    clear() { store.clear(); }
  });
}
