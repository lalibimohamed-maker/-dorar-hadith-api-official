import test from "node:test";
import assert from "node:assert/strict";
import { OmegaVisualPruner } from "../packages/omega-browser/src/omega-visual-pruner.js";

test("visual budget is model-profile driven rather than a universal fixed token count", () => {
  const profile = OmegaVisualPruner.qwen2VisionProfile();
  assert.equal(OmegaVisualPruner.estimateVisualTokens(224, 224, profile), 64);
  assert.equal(OmegaVisualPruner.estimateVisualTokens(448, 448, profile), 256);
  const plan = OmegaVisualPruner.plan(2048, 3072, { target_runtime: "WASM" }, profile);
  assert.ok(plan.target.width <= 224 || plan.target.height <= 224 || plan.estimated_visual_tokens <= 256);
  assert.ok(plan.target.width % 28 === 0);
  assert.ok(plan.target.height % 28 === 0);
  assert.ok(plan.estimated_visual_tokens <= 256);
});

test("wide document pages keep their aspect ratio while reducing pixel budget", () => {
  const profile = { patch_size: 14, merge_size: 2, target_visual_tokens: 256, min_pixels: 28 * 28, max_pixels: 28 * 28 * 256, max_dimension: 448 };
  const plan = OmegaVisualPruner.plan(2400, 1200, {}, profile);
  assert.ok(plan.target.width > plan.target.height);
  const sourceRatio = 2400 / 1200;
  const targetRatio = plan.target.width / plan.target.height;
  assert.ok(Math.abs(sourceRatio - targetRatio) < 0.12);
});

test("pruner requires a browser canvas factory only at actual rasterization time", () => {
  assert.throws(
    () => OmegaVisualPruner.pruneVisualTokens({ width: 100, height: 100 }, {}, {}),
    /DOM_CANVAS_FACTORY_UNAVAILABLE/
  );
});
