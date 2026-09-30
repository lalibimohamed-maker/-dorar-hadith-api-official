import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("dual storage registry defines primary and Omega storage targets", () => {
  const cfg = JSON.parse(fs.readFileSync("config/rechercher-omega-storage-registry.json", "utf8"));
  assert.equal(cfg.policy.check_all_targets_before_acquisition, true);
  const repos = new Set(cfg.targets.map((t) => t.repository));
  assert.equal(repos.has("lalibimohamed-maker/-dorar-hadith-api-official"), true);
  assert.equal(repos.has("lalibimohamed-maker/rechercher-omega-engine-storage"), true);
});

test("storage verifier checks both targets and uses release-manifest as completeness gate", () => {
  const source = fs.readFileSync("scripts/rechercher-omega-storage-reconcile.py", "utf8");
  assert.match(source, /primary/);
  assert.match(source, /rechercher-omega-engine-storage/);
  assert.match(source, /release-manifest\.json/);
  assert.match(source, /complete_anywhere/);
  assert.match(source, /complete_targets/);
});
