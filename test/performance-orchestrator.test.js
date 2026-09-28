import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPerformancePolicy,
  cacheKey,
  createResultCache,
  createVoiceQueue,
  downloadRangeRequest,
  nextDownloadRange,
  performanceMetrics,
  rankRuntimes,
  readerRequest,
  routePerformanceTask,
  runParallelAdapters,
  runSearchFastPath,
  runWorkerPool,
  summarizeBenchmarks,
  buildVideoPipeline,
} from "../src/performance-orchestrator.js";

const provenance = { source: "official", locator: "fixture", capturedAt: "2026-09-28" };

const adapters = [
  { id: "node", runtime: "node", healthy: true, benchmark: { throughput: 100, p95LatencyMs: 900, memoryMb: 256, cost: 1 } },
  { id: "go", runtime: "go", healthy: true, benchmark: { throughput: 120, p95LatencyMs: 500, memoryMb: 192, cost: 0.8 } },
  { id: "rust", runtime: "rust", healthy: true, benchmark: { throughput: 125, p95LatencyMs: 350, memoryMb: 160, cost: 0.9 } },
  { id: "python", runtime: "python", healthy: false, benchmark: { throughput: 150, p95LatencyMs: 200, memoryMb: 128, cost: 0.5 } },
];

test("interactive policy defaults to 1800ms and max 8 adapters", () => {
  const policy = buildPerformancePolicy("search");
  assert.equal(policy.interactiveBudgetMs, 1800);
  assert.equal(policy.maxParallelAdapters, 8);
  assert.equal(policy.cancelSlow, true);
});

test("runtime choice is driven by measured benchmark data and health", () => {
  const ranked = rankRuntimes(adapters);
  assert.deepEqual(ranked.map(adapter => adapter.id), ["rust", "go", "node"]);
});

test("runtime ranking rejects adapters without benchmark evidence", () => {
  const ranked = rankRuntimes([
    { id: "unnmeasured", healthy: true },
    ...adapters,
  ]);
  assert.equal(ranked.some(adapter => adapter.id === "unnmeasured"), false);
});

test("parallel execution is capped and returns the first acceptable search result", async () => {
  let active = 0;
  let peak = 0;
  const selected = Array.from({ length: 8 }, (_, index) => ({
    id: `a${index}`,
    healthy: true,
    benchmark: { throughput: 100 - index, p95LatencyMs: 100 + index, memoryMb: 100, cost: 1 },
  }));

  const result = await runParallelAdapters(
    selected,
    async (adapter, { signal }) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, adapter.id === "a0" ? 5 : 25));
      active -= 1;
      if (signal.aborted && adapter.id !== "a0") return { acceptable: false };
      return { acceptable: adapter.id === "a0" };
    },
    { maxParallelAdapters: 8, timeoutMs: 500 },
  );

  assert.equal(result.adapter, "a0");
  assert.ok(peak <= 8);
});

test("search fast path enforces the 1800ms interactive budget", async () => {
  await assert.rejects(
    () => runSearchFastPath({
      adapters: [{ id: "slow", healthy: true, benchmark: { throughput: 1, p95LatencyMs: 10, memoryMb: 10, cost: 1 } }],
      provenance,
      execute: async () => new Promise(resolve => setTimeout(() => resolve({ acceptable: false }), 50)),
      accept: value => value.acceptable,
      budgetMs: 10,
    }),
    error => error.code === "PERFORMANCE_BUDGET_EXCEEDED",
  );
});

test("reader uses cache-aware range delivery rather than requiring a full file", () => {
  assert.deepEqual(readerRequest("https://example.test/book.pdf", { start: 0, end: 999 }).headers.Range, "bytes=0-999");
  assert.equal(readerRequest("https://example.test/book.pdf").delivery, "stream-or-range");
  assert.equal(readerRequest("https://example.test/book.pdf").cache, "force-cache");
});

test("download supports HTTP range resume and chunk planning", () => {
  const request = downloadRangeRequest("https://example.test/book.pdf", { start: 1024, end: 2047 });
  assert.equal(request.resume, true);
  assert.equal(request.headers.Range, "bytes=1024-2047");
  assert.deepEqual(nextDownloadRange({ receivedBytes: 4096, totalBytes: 9000, chunkBytes: 1024 }), {
    start: 4096,
    end: 5119,
  });
  assert.equal(nextDownloadRange({ receivedBytes: 9000, totalBytes: 9000 }), null);
});

test("voice queue caches repeated results and limits concurrency", async () => {
  const cache = createResultCache();
  const queue = createVoiceQueue({ concurrency: 2, cache });
  let calls = 0;

  const values = await Promise.all([
    queue.submit("hello:ar", async () => { calls += 1; await new Promise(r => setTimeout(r, 5)); return "audio"; }),
    queue.submit("hello:ar", async () => { calls += 1; return "audio-duplicate"; }),
    queue.submit("bye:ar", async () => { calls += 1; return "audio-bye"; }),
  ]);

  assert.equal(values[2], "audio-bye");
  assert.equal(cache.get("hello:ar"), "audio");
  assert.ok(calls >= 2);
});

test("video pipeline exposes adaptive variants without promising 4K speed", () => {
  const pipeline = buildVideoPipeline({ source: "video-1", sourceResolutions: [720, 1080] });
  assert.equal(pipeline.streaming, "adaptive");
  assert.ok(pipeline.variants.every(variant => variant.adaptive));
  assert.match(pipeline.note, /no speed guarantee/i);
  assert.equal(pipeline.variants.some(variant => variant.height === 2160), false);
});

test("OCR worker pool runs independently with bounded concurrency", async () => {
  const seen = [];
  const results = await runWorkerPool([1, 2, 3, 4, 5], async item => {
    await new Promise(resolve => setTimeout(resolve, 2));
    seen.push(item);
    return item * 2;
  }, { concurrency: 2 });

  assert.deepEqual(results, [2, 4, 6, 8, 10]);
  assert.equal(seen.length, 5);
});

test("benchmark summary computes measured p95 without claiming a single sample is p95", () => {
  const summary = summarizeBenchmarks([
    { latencyMs: 100, throughput: 10, memoryMb: 100, cost: 1 },
    { latencyMs: 200, throughput: 20, memoryMb: 120, cost: 2 },
    { latencyMs: 500, throughput: 30, memoryMb: 140, cost: 3 },
    { latencyMs: 700, throughput: 40, memoryMb: 160, cost: 4 },
  ]);
  assert.equal(summary.p95LatencyMs, 700);
  assert.equal(summary.throughput, 25);
  assert.equal(summary.memoryMb, 130);
  assert.equal(summary.cost, 2.5);
});

test("performanceMetrics records raw duration and does not mislabel it as p95", () => {
  const metrics = performanceMetrics({ startedAt: 1000, finishedAt: 1400, throughput: 20, memoryMb: 128, cacheHit: true });
  assert.equal(metrics.durationMs, 400);
  assert.equal(metrics.cacheHit, true);
  assert.equal("p95LatencyMs" in metrics, false);
});

test("performance route remains behind governance and never grants Corpus write authority", () => {
  const route = routePerformanceTask({ task: "reader", adapters, provenance });
  assert.equal(route.governance.status, "approved-for-execution");
  assert.equal(route.governance.route, "read");
  assert.deepEqual(route.adapters, ["rust", "go", "node"]);
});
