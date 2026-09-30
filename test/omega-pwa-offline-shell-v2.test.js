import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("PWA shell contains the offline store, provider and UI", async () => {
  const sw = await readFile("web/sw.js", "utf8");
  assert.match(sw, /\.\/omega-offline-store\.js/);
  assert.match(sw, /\.\/omega-local-provider\.js/);
  assert.match(sw, /\.\/offline-omega-ui\.js/);
});

test("web app loads the local store before the provider boundary", async () => {
  const app = await readFile("web/app.js", "utf8");
  assert.match(app, /installLocalStoreBoundary\(\)/);
  assert.match(app, /installLocalProviderBoundary\(\)/);
  assert.match(app, /registerOfflineAppShell\(\)/);
});

test("browser build is network-free", async () => {
  const build = await readFile("packages/omega-browser/build.js", "utf8");
  assert.equal(build.includes("npx"), false);
  assert.equal(build.includes("esbuild"), false);
});
