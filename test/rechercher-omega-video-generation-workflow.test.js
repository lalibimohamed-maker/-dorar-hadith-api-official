import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(
  " .github/workflows/rechercher-omega-video-generation.yml".trim(),
  "utf8",
);

test("LTX-2 distilled workflow uses upstream argument names", () => {
  assert.match(workflow, /--checkpoint-path "\$checkpoint"/);
  assert.match(workflow, /--gemma-root "\$GEMMA_ROOT"/);
  assert.match(workflow, /--spatial-upsampler-path "\$spatial"/);
  assert.match(workflow, /--image "\$IMAGE_PATH" 0 1\.0/);
  assert.doesNotMatch(workflow, /--distilled-checkpoint-path "\$checkpoint"/);
});

test("Hunyuan workflow uses documented model path flags", () => {
  assert.match(workflow, /--resolution "\$resolution"/);
  assert.match(workflow, /--model_path "\$MODEL_DIR"/);
  assert.match(workflow, /--cfg_distilled "\$cfg_distilled"/);
  assert.match(workflow, /--enable_step_distill "\$step_distill"/);
  assert.match(workflow, /--image_path "\$IMAGE_PATH"/);
});

test("generation workflow cannot run without explicit terms gate", () => {
  assert.match(workflow, /if: \$\{\{ inputs\.run_generation && inputs\.terms_cleared \}\}/);
});
