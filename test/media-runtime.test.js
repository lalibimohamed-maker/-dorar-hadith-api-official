import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const runtime=JSON.parse(fs.readFileSync(path.join(root,'config/media-runtime-2026.json'),'utf8'));
const studio=JSON.parse(fs.readFileSync(path.join(root,'config/media-studio-toolchain-2026.json'),'utf8'));
const bridge=JSON.parse(fs.readFileSync(path.join(root,'config/rechercher-omega-media-bridge-2026.json'),'utf8'));
const models=JSON.parse(fs.readFileSync(path.join(root,'config/rechercher-omega-model-registry.json'),'utf8'));

test('complete runtime manifest covers every selected interoperability/media component',()=>{
  const ids=new Set(runtime.software.map(x=>x.id));
  for(const id of ['nifi','ditto','nats','openusd','gltf','gltf-validator','real-esrgan','video2x','ffmpeg','tesseract','paddleocr','colmap','open3d','mediamtx']) {
    assert.equal(ids.has(id),true,`missing runtime component: ${id}`);
  }
});

test('professional studio toolchain covers the production stack',()=>{
  const ids=new Set(studio.tools.map(x=>x.id));
  for(const id of ['kdenlive','blender','obs','ardour','audacity','gimp','inkscape','glaxnimate','imagemagick','opentimelineio','opencolorio']) {
    assert.equal(ids.has(id),true,`missing studio tool: ${id}`);
  }
  for(const tool of studio.tools) {
    assert.ok(tool.version && tool.license && tool.source && tool.licenseEvidence, `incomplete provenance for ${tool.id}`);
  }
});

test('Omega bridge links AI production tasks to execution tools',()=>{
  assert.equal(bridge.aiBranch.pr,566);
  assert.equal(bridge.executionBranch.pr,601);
  assert.equal(bridge.executionBranch.branch,'feat/open-interoperability-fabric-2026-stacked');
  assert.equal(runtime.omegaBridge.executionPr,601);
  const execution=new Set([
    ...runtime.software.map(x=>x.id),
    ...studio.tools.map(x=>x.id)
  ]);
  const aiModels=new Set(models.models.map(x=>x.id));
  for(const routingTools of Object.values(bridge.taskRouting)) {
    for(const tool of routingTools) {
      assert.equal(execution.has(tool) || aiModels.has(tool), true, `unresolved bridge tool/model: ${tool}`);
    }
  }
});

test('runtime weights are release-backed and never stored in Git',()=>{
  assert.equal(runtime.weightsRelease.sourceOfTruth,'github-release-assets');
  assert.equal(runtime.weightsRelease.noWeightsInGit,true);
  assert.match(runtime.weightsRelease.tag,/^dinullah-media-weights-/);
});

test('all heavyweight runtimes have explicit pinned versions',()=>{
  for(const id of ['nifi','ditto','nats','openusd','video2x','paddleocr','colmap','open3d','mediamtx']) {
    const item=runtime.software.find(x=>x.id===id);
    assert.ok(item.version);
  }
});
