import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const registry = JSON.parse(fs.readFileSync(path.join(root,"config","rechercher-omega-model-registry.json"),"utf8"));
const weights = JSON.parse(fs.readFileSync(path.join(root,"config","rechercher-omega-model-weights.json"),"utf8"));
const runtime = JSON.parse(fs.readFileSync(path.join(root,"config","rechercher-omega-sana-sprint16-runtime.json"),"utf8"));
const workflow = fs.readFileSync(path.join(root,".github","workflows","rechercher-omega-remaining-engine-acquisition.yml"),"utf8");

test("SANA-Sprint is registered as the fast open FLUX substitute",()=>{
  const model=registry.models.find(x=>x.id==="sana-sprint");
  assert.ok(model);
  assert.equal(model.license_status,"verified_source_license");
  assert.equal(model.approximate_size_gb,6.45);
  assert.equal(model.resolution,"1024px");
  assert.equal(model.runtime_status,"dependency_blocked_until_gemma_clearance");
});

test("SANA-Sprint weight acquisition is pinned and Release-only",()=>{
  const entry=weights.weights.find(x=>x.model_id==="sana-sprint");
  assert.ok(entry);
  assert.match(entry.revision,/^[0-9a-f]{40}$/);
  assert.equal(entry.acquisition,"github_release");
  assert.equal(entry.release_tag,"rechercher-omega-sana-sprint16-v1.0.0");
  assert.equal(entry.runtime_dependency.embedded,false);
});

test("SANA-Sprint runtime fails closed on the Gemma dependency",()=>{
  assert.equal(runtime.runtime_status,"dependency_blocked");
  const dep=runtime.required_external_dependencies.find(x=>x.id==="gemma-2-2b-it");
  assert.ok(dep);
  assert.equal(dep.embedded,false);
  assert.equal(dep.status,"clearance_required");
  assert.equal(runtime.policy.never_commit_weights,true);
  assert.equal(runtime.policy.release_assets_only,true);
});

test("Omega acquisition workflow contains the SANA Release path",()=>{
  assert.match(workflow,/id: sana-sprint-1\.6b/);
  assert.match(workflow,/Sana_Sprint_1\.6B_1024px/);
  assert.match(workflow,/rechercher-omega-sana-sprint16-v1\.0\.0/);
  assert.match(workflow,/Stream weights directly into Release/);
  assert.match(workflow,/Build SANA-Sprint 1\.6B runtime metadata/);
});
