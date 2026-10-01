import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { OmegaHardwareGuardian } from "../packages/omega-browser/src/omega-hardware-guardian.js";

test("hardware guardian protects storage without assuming persistence is guaranteed", async () => {
  let calls = 0;
  const storage = {
    async persisted() { return false; },
    async persist() { calls += 1; return true; }
  };
  const result = await OmegaHardwareGuardian.securePersistentStorage({
    storageObject: storage,
    navigatorObject: { storage }
  });
  assert.equal(calls, 1);
  assert.equal(result.persisted, true);
  assert.equal(result.granted, true);
});

test("audio guardian checkpoints the actual capture offset on OS interruption", async () => {
  let saved = null;
  const listeners = {};
  const audio = {
    state: "running",
    set onstatechange(value) { listeners.state = value; },
    get onstatechange() { return listeners.state; },
    resume: async () => { audio.state = "running"; }
  };
  const cleanup = OmegaHardwareGuardian.monitorAudioContextResilience(audio, {
    sessionId: "s1",
    getByteOffset: () => 4096,
    getSequence: () => 7,
    checkpoint: async value => { saved = value; }
  });
  audio.state = "interrupted";
  listeners.state();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(saved.byte_offset, 4096);
  assert.equal(saved.sequence, 7);
  assert.equal(saved.status, "PAUSED_BY_OS");
  cleanup();
});

test("WebGPU guard uses GPUDevice uncapturederror and lost, then requests WASM", async () => {
  let fallback = null;
  let lostResolve;
  const listeners = {};
  const device = {
    lost: new Promise(resolve => { lostResolve = resolve; }),
    addEventListener(type, handler) { listeners[type] = handler; },
    removeEventListener() {}
  };
  const cleanup = OmegaHardwareGuardian.watchWebGPUDeviceLoss(device, {
    initialChunkSize: 128,
    fallbackToWasmCallback: detail => { fallback = detail; }
  });
  listeners.uncapturederror({ error: new Error("boom") });
  lostResolve({ reason: "unknown", message: "device lost" });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(fallback.backend, "wasm");
  assert.equal(fallback.suggested_chunk_size, 64);
  cleanup();
});

test("browser app shell contains the hardware guardian and integrity worker", async () => {
  const sw = await readFile("web/sw.js", "utf8");
  const app = await readFile("web/app.js", "utf8");
  const ui = await readFile("web/offline-omega-ui.js", "utf8");
  const store = await readFile("web/omega-offline-store.js", "utf8");
  assert.match(sw, /omega-hardware-guardian\.js/);
  assert.match(sw, /omega-offline-evidence-worker\.js/);
  assert.match(app, /omega-hardware-guardian\.js/);
  assert.match(ui, /importEvidenceBundleFile/);
  assert.match(store, /importEvidenceBundleFile/);
});
