import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("offline UI exposes explicit modes, network state and quick access", async () => {
  const ui = await readFile("web/offline-omega-ui.js", "utf8");
  assert.match(ui, /offline_only/);
  assert.match(ui, /online_only/);
  assert.match(ui, /navigator\.onLine/);
  assert.match(ui, /omega-quick-search/);
  assert.match(ui, /prefers-reduced-motion/);
});

test("PWA shell includes the offline UI and provider bridge", async () => {
  const sw = await readFile("web/sw.js", "utf8");
  assert.match(sw, /\.\/offline-omega-ui\.js/);
  assert.match(sw, /\.\/omega-local-provider\.js/);
});

test("web app has a no-network branch for offline-only mode", async () => {
  const app = await readFile("web/app.js", "utf8");
  assert.match(app, /getOmegaMode\(\)==="offline_only"/);
  assert.match(app, /deenAllahOmegaLocalSearch/);
  assert.match(app, /deenallah:search:start/);
  assert.match(app, /deenallah:search:end/);
});
