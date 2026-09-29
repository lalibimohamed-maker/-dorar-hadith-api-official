import test from "node:test";
import assert from "node:assert/strict";
import {
  PARALLEL_SEARCH_LIMITS,
  deduplicateSearchRecords,
  resolveSearchLanguage,
  runParallelSearchProviders
} from "../src/parallel-search-governance.js";

test("parallel search governance caps concurrent providers at eight", async () => {
  let active = 0;
  let peak = 0;
  const jobs = Array.from({ length: 12 }, (_, i) => ({
    id: `p-${i}`,
    run: async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active -= 1;
      return [{ id: `result-${i}`, title: `R${i}`, url: `https://example.org/${i}` }];
    }
  }));
  const out = await runParallelSearchProviders({ query: "علم", jobs });
  assert.equal(out.totalJobs, 12);
  assert.equal(out.completedJobs, 12);
  assert.ok(peak <= 8);
  assert.equal(out.concurrencyLimit, 8);
});

test("one slow provider is isolated by timeout and other providers still complete", async () => {
  const out = await runParallelSearchProviders({
    query: "قرآن",
    jobs: [
      { id: "fast", run: async () => "ok" },
      { id: "slow", run: async ({ signal }) => {
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, 200);
          signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
        });
        if (signal?.aborted) throw new Error("provider-timeout");
        return "too-late";
      } }
    ],
    timeoutMs: 250
  });
  assert.equal(out.completedJobs, 2);
  assert.equal(out.degradedJobs, 0);

  const timed = await runParallelSearchProviders({
    query: "قرآن",
    jobs: [
      { id: "fast", run: async () => "ok" },
      { id: "slow", run: async () => new Promise(() => {}) }
    ],
    timeoutMs: 250
  });
  assert.equal(timed.completedJobs, 1);
  assert.equal(timed.degradedJobs, 1);
  assert.equal(timed.results.find((r) => r.providerId === "slow").status, "timeout");
});

test("provider failures are fail-soft and retry is bounded", async () => {
  let attempts = 0;
  const out = await runParallelSearchProviders({
    query: "حديث",
    retries: 1,
    jobs: [
      { id: "flaky", retryable: true, run: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("temporary");
        return ["ok"];
      } },
      { id: "broken", run: async () => { throw new Error("broken"); } }
    ]
  });
  assert.equal(attempts, 2);
  assert.equal(out.completedJobs, 1);
  assert.equal(out.degradedJobs, 1);
  assert.equal(out.results.find((r) => r.providerId === "broken").status, "failed");
});

test("deduplication preserves the strongest duplicate and keeps distinct routes", () => {
  const out = deduplicateSearchRecords([
    { id: "a", title: "A", url: "https://example.org/a", relevance: 0.2 },
    { id: "b", title: "A2", url: "https://example.org/a/", relevance: 0.9 },
    { id: "c", title: "A", url: "https://example.org/a?lang=ar", relevance: 0.3 },
    { id: "same-title-1", title: "Same title", source: "source-1", relevance: 0.1 },
    { id: "same-title-2", title: "Same title", source: "source-2", relevance: 0.2 }
  ]);
  assert.ok(out.some((item) => item.id === "b"));
  assert.ok(out.some((item) => item.id === "c"));
  assert.equal(out.filter((item) => item.title === "Same title").length, 2);
});

test("language resolution is deterministic and does not expose provider topology", () => {
  const out = resolveSearchLanguage("fr-CA");
  assert.equal(out.resolved, "fr-ca");
  assert.equal(out.sourceLanguageResolution, "request-locale");
  assert.equal(PARALLEL_SEARCH_LIMITS.maxConcurrent, 8);
  assert.equal(PARALLEL_SEARCH_LIMITS.defaultTimeoutMs, 1200);
});


test("cache and retry are opt-in per provider rather than global defaults", async () => {
  let attempts = 0;
  const cache = new Map();
  const adapter = {
    get: (key) => cache.get(key),
    set: (key, value) => cache.set(key, value),
    delete: (key) => cache.delete(key)
  };
  const { runParallelSearchProviders } = await import("../src/parallel-search-governance.js");
  const first = await runParallelSearchProviders({
    query: "test",
    cache: adapter,
    retries: 2,
    jobs: [{
      id: "brave",
      run: async () => {
        attempts += 1;
        throw new Error("rate-limited");
      }
    }]
  });
  assert.equal(first.degradedJobs, 1);
  assert.equal(attempts, 1);
  assert.equal(adapter.get("brave::ar::test"), undefined);

  let permittedAttempts = 0;
  const permitted = await runParallelSearchProviders({
    query: "test",
    cache: adapter,
    retries: 2,
    jobs: [{
      id: "local-permitted",
      cacheable: true,
      retryable: true,
      run: async () => {
        permittedAttempts += 1;
        if (permittedAttempts < 2) throw new Error("transient");
        return "ok";
      }
    }]
  });
  assert.equal(permitted.completedJobs, 1);
  assert.equal(permittedAttempts, 2);
  assert.ok(adapter.get("local-permitted::ar::test"));
});
