import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("offline evidence delta is worker-driven and signed", async () => {
  const sync = await readFile("web/omega-offline-delta-sync.js", "utf8");
  const sw = await readFile("web/sw.js", "utf8");
  const store = await readFile("web/omega-offline-store.js", "utf8");
  assert.match(sync, /dinullah\/omega-offline-evidence-delta/);
  assert.match(sync, /Ed25519/);
  assert.match(sync, /OFFLINE_DELTA_BASE_SNAPSHOT_MISMATCH/);
  assert.match(sync, /OFFLINE_DELTA_TARGET_SNAPSHOT_MISMATCH/);
  assert.match(sync, /db\.transaction\(\[STORE_NAME, META_STORE\], "readwrite"\)/);
  assert.match(sw, /OMEGA_APPLY_EVIDENCE_DELTA/);
  assert.match(store, /DB_VERSION = 2/);
  assert.match(store, /sync_state/);
});

test("offline delta cannot cross a dirty local state", async () => {
  const sync = await readFile("web/omega-offline-delta-sync.js", "utf8");
  assert.match(sync, /OFFLINE_DELTA_LOCAL_STATE_DIRTY/);
  assert.match(sync, /currentState\?\.sequence/);
});
