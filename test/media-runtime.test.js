import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const runtime=JSON.parse(fs.readFileSync(path.join(root,'config/media-runtime-2026.json'),'utf8'));

test('complete runtime manifest covers every selected interoperability/media component',()=>{
  const ids=new Set(runtime.software.map(x=>x.id));
  for(const id of ['nifi','ditto','nats','openusd','gltf','gltf-validator','real-esrgan','video2x','ffmpeg','tesseract','paddleocr','colmap','open3d','mediamtx']) {
    assert.equal(ids.has(id),true,`missing runtime component: ${id}`);
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
