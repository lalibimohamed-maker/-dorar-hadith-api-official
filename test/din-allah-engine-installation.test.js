import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const manifestUrl = new URL("../config/din-allah-engine-installation-manifest-2026.json", import.meta.url);

test("engine installation manifest is free-first and fail-closed", async () => {
  const manifest = JSON.parse(await fs.readFile(manifestUrl, "utf8"));
  assert.equal(manifest.policy.freeFirst, true);
  assert.equal(manifest.policy.noPaidCoreDependency, true);
  assert.equal(manifest.policy.noCorpusMutation, true);
  assert.equal(manifest.policy.noModelWeightsInGit, true);

  const ids = new Set(manifest.engines.map(engine => engine.id));
  for (const required of [
    "ffmpeg", "ffprobe", "blender", "pyscenedetect",
    "opentimelineio", "whisper", "faster-whisper", "whisperx",
    "paddleocr-vl", "docling", "openvino"
  ]) {
    assert.ok(ids.has(required), "missing engine: " + required);
  }

  for (const engine of manifest.engines) {
    assert.ok(engine.source.startsWith("https://"), "missing upstream source: " + engine.id);
    assert.ok(engine.license, "missing license record: " + engine.id);
  }
});
