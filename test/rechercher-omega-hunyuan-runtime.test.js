import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const config = JSON.parse(
  fs.readFileSync(
    path.join(root, "config", "rechercher-omega-hunyuanvideo15-runtime.json"),
    "utf8",
  ),
);

const workflow = fs.readFileSync(
  path.join(
    root,
    ".github",
    "workflows",
    "rechercher-omega-remaining-engine-acquisition.yml",
  ),
  "utf8",
);

test("Hunyuan runtime policy requires a separate readiness gate", () => {
  assert.equal(config.logical_id, "hunyuanvideo-1.5");
  assert.equal(
    config.status_policy.runnable_requires_all_external_dependencies,
    true,
  );
  assert.match(workflow, /hunyuanvideo15-release-readiness\.json/);
  assert.match(workflow, /hunyuanvideo15-runtime-manifest\.json/);
  assert.match(workflow, /omega__hunyuanvideo15__runtime\.tar\.gz/);
});

test("release-manifest is explicitly weights-only", () => {
  assert.match(workflow, /weights[- ]only/i);
  assert.match(workflow, /runtime completeness/i);
});

test("gated vision dependency cannot be auto-promoted", () => {
  const vision = config.external_dependencies.find(
    (dependency) => dependency.id === "flux-redux-dev",
  );
  assert.ok(vision);
  assert.equal(vision.status, "gated_access_required");
  assert.equal(vision.required, true);
});

test("Hunyuan core runtime files are required", () => {
  assert.ok(config.model_runtime_paths.includes("config.json"));
  assert.ok(config.model_runtime_paths.includes("scheduler/*.json"));
  assert.ok(config.model_runtime_paths.includes("transformer/**/*.json"));
  assert.ok(config.model_runtime_paths.includes("vae/**/*.json"));
});
