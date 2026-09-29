import test from "node:test";
import assert from "node:assert/strict";
import { buildVmafCommand, buildSceneDetectionCommand } from "../src/media/media-analysis-tools.mjs";

test("VMAF planner creates a reference-quality analysis command without Corpus writes", () => {
  const plan = buildVmafCommand({
    referencePath: "source.mp4",
    distortedPath: "derived.mp4",
    outputPath: "-"
  });
  assert.equal(plan.command, "ffmpeg");
  assert.ok(plan.args.includes("libvmaf=model=path=model/vmaf_v1.0.16/vmaf_v1.0.16_3d0h.json"));
  assert.equal(plan.corpus_write_allowed, false);
});

test("scene detection planner supports adaptive detection and optional thumbnails", () => {
  const plan = buildSceneDetectionCommand({
    inputPath: "source.mp4",
    outputDir: "artifacts/scenes",
    detector: "detect-adaptive",
    saveImages: true
  });
  assert.equal(plan.command, "scenedetect");
  assert.ok(plan.args.includes("detect-adaptive"));
  assert.ok(plan.args.includes("save-images"));
  assert.equal(plan.corpus_write_allowed, false);
});

test("scene detection rejects unapproved detector commands", () => {
  assert.throws(
    () => buildSceneDetectionCommand({ inputPath:"x.mp4", outputDir:"out", detector:"--exec" }),
    /unsupported scene detector/
  );
});
