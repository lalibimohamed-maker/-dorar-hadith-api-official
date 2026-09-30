import test from "node:test";
import assert from "node:assert/strict";
import {
  clearLocalBrowserModuleCache,
  loadLocalBrowserModule,
  resolveLocalRuntime
} from "../packages/omega-browser/src/local-bundle-loader.js";

const locationObject = { href: "https://example.test/app/index.html", origin: "https://example.test" };

test("local browser module rejects cross-origin runtime URLs", async () => {
  const result = await loadLocalBrowserModule("https://cdn.example.net/omega.js", {
    locationObject,
    importImpl: async () => ({ ok: true })
  });
  assert.equal(result.status, "rejected");
});

test("timeout does not claim import cancellation and a late local module remains reusable", async () => {
  clearLocalBrowserModuleCache();
  let calls = 0;
  const slowImport = async () => {
    calls += 1;
    await new Promise(resolve => setTimeout(resolve, 25));
    return { createGenerator: () => ({ generate: async () => "ok" }) };
  };

  const timedOut = await loadLocalBrowserModule("/omega.js", {
    timeoutMs: 5,
    importImpl: slowImport,
    locationObject
  });
  assert.equal(timedOut.status, "timeout");

  await new Promise(resolve => setTimeout(resolve, 35));
  const ready = await loadLocalBrowserModule("/omega.js", {
    timeoutMs: 50,
    importImpl: slowImport,
    locationObject
  });
  assert.equal(ready.status, "ready");
  assert.equal(calls, 1);

  clearLocalBrowserModuleCache();
});

test("auto mode falls back online after local readiness timeout", async () => {
  clearLocalBrowserModuleCache();
  const result = await resolveLocalRuntime({
    mode: "auto",
    moduleUrl: "/omega.js",
    timeoutMs: 2,
    importImpl: async () => new Promise(() => {}),
    onlineFallback: async () => "online",
    locationObject
  });
  assert.equal(result.status, "online");
  assert.equal(result.local_failure, "LOCAL_RUNTIME_LOAD_TIMEOUT");
  clearLocalBrowserModuleCache();
});
