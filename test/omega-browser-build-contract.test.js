import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("browser package build is isolated and network-free", async () => {
  const packageJson = JSON.parse(await readFile("packages/omega-browser/package.json", "utf8"));
  const lock = JSON.parse(await readFile("packages/omega-browser/package-lock.json", "utf8"));
  const build = await readFile("packages/omega-browser/build.js", "utf8");
  const gitignore = await readFile("packages/omega-browser/.gitignore", "utf8");
  const core = await readFile("packages/omega-browser/src/omega-client-core.js", "utf8");
  const buildPackage = await readFile("packages/omega-browser/build.js", "utf8");
  const worker = await readFile("packages/omega-browser/src/webgpu-inference-worker.js", "utf8");

  assert.equal(packageJson.name, "@dinullah/omega-browser");
  assert.equal(lock.name, "@dinullah/omega-browser");
  assert.equal(build.includes("npx"), false);
  assert.equal(build.includes("esbuild"), false);
  assert.equal(build.includes("fetch("), false);
  assert.equal(core.includes("../../../src/offline/arabic-query-normalizer.js"), false);
  assert.match(core, /\.\/arabic-query-normalizer\.js/);
  assert.match(core, /omega-hardware-guardian\.js/);
  assert.match(buildPackage, /omega-hardware-guardian\.js/);
  assert.match(buildPackage, /omega-audio-session\.js/);
  assert.match(buildPackage, /omega-visual-pruner\.js/);
  assert.match(buildPackage, /omega-multimodal-context-guard\.js/);
  assert.match(buildPackage, /omega-client-core\.js/);
  assert.doesNotMatch(worker, /importScripts\(/);
  assert.match(worker, /GPUDevice|gpuDevice|webgpuDevice/);
  assert.equal(gitignore.includes("dist/"), true);
});
