import test from "node:test";
import assert from "node:assert/strict";
import { createAccelerationMesh, cachePolicyForPath } from "../src/acceleration-mesh.js";

test("acceleration mesh caches values and reports hits", () => {
  const mesh = createAccelerationMesh({ maxEntries: 2, maxBytes: 1024 * 1024 });
  mesh.set("one", Buffer.from(JSON.stringify({ ok: true })), { ttlMs: 10_000, contentType: "application/json; charset=utf-8" });
  assert.equal(mesh.get("one")?.status, 200);
  assert.equal(mesh.profile().hits, 1);
  assert.equal(mesh.profile().misses, 0);
});

test("acceleration mesh expires entries deterministically", async () => {
  const mesh = createAccelerationMesh({ maxEntries: 2, maxBytes: 1024 * 1024 });
  mesh.set("short", Buffer.from("hello"), { ttlMs: 1 });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(mesh.get("short"), null);
  assert.equal(mesh.profile().misses, 1);
});

test("compression prefers Brotli and can fall back to gzip", () => {
  const mesh = createAccelerationMesh({ minCompressBytes: 1 });
  const input = Buffer.from("موسوعة دين الله ".repeat(200), "utf8");
  const br = mesh.compress(input, "gzip, br");
  assert.equal(br.encoding, "br");
  assert.ok(br.body.length < input.length);
  const gzip = mesh.compress(input, "gzip");
  assert.equal(gzip.encoding, "gzip");
  assert.ok(gzip.body.length < input.length);
});

test("cache policies favor short search TTLs and longer corpus TTLs", () => {
  assert.equal(cachePolicyForPath("/search").ttlMs, 8_000);
  assert.equal(cachePolicyForPath("/quran/ayah").ttlMs, 120_000);
  assert.equal(cachePolicyForPath("/sources").ttlMs, 60_000);
  assert.equal(cachePolicyForPath("/health").cache, false);
});

test("single-flight coalesces identical expensive work", async () => {
  const mesh = createAccelerationMesh();
  let calls = 0;
  const work = () => mesh.singleFlight("same", async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return 42;
  });
  const results = await Promise.all([work(), work(), work(), work()]);
  assert.deepEqual(results, [42, 42, 42, 42]);
  assert.equal(calls, 1);
  assert.equal(mesh.profile().coalesced, 3);
});
