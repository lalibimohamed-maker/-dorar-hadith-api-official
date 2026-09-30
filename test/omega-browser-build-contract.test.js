import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("browser package build remains isolated and shell-free", async () => {
  const packageJson = JSON.parse(await readFile("packages/omega-browser/package.json", "utf8"));
  const lock = JSON.parse(await readFile("packages/omega-browser/package-lock.json", "utf8"));
  const build = await readFile("packages/omega-browser/build.js", "utf8");
  const gitignore = await readFile("packages/omega-browser/.gitignore", "utf8");

  assert.equal(packageJson.name, "@dinullah/omega-browser");
  assert.equal(lock.name, "@dinullah/omega-browser");
  assert.equal(build.includes("esbuild@0.28.2"), true);
  assert.equal(build.includes("shell: false"), true);
  assert.equal(gitignore.includes("dist/"), true);
});
