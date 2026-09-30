import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("offline delta schema and service-worker path require the signed snapshot-v2 contract", async () => {
  const schema = JSON.parse(await readFile("config/omega-offline-evidence-delta.schema.json", "utf8"));
  const example = JSON.parse(await readFile("config/omega-offline-evidence-delta.example.json", "utf8"));
  const sw = await readFile("web/sw.js", "utf8");
  const app = await readFile("web/app.js", "utf8");
  const sync = await readFile("web/omega-offline-delta-sync.js", "utf8");

  assert.equal(schema.properties.snapshot_algorithm.const, "omega-evidence-snapshot-v2");
  assert.ok(schema.required.includes("snapshot_algorithm"));
  assert.equal(example.snapshot_algorithm, "omega-evidence-snapshot-v2");
  assert.match(sw, /OMEGA_APPLY_EVIDENCE_DELTA/);
  assert.match(sw, /importScripts\("\.\/omega-offline-delta-sync\.js"\)/);
  assert.match(app, /deenAllahOmegaDeltaSync/);
  assert.match(sync, /OFFLINE_DELTA_LOCAL_STATE_DIRTY/);
  assert.match(sync, /OFFLINE_DELTA_LOCAL_SNAPSHOT_CORRUPT/);
  assert.match(sync, /OFFLINE_DELTA_CROSS_ORIGIN_REJECTED/);
});
