import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const runtime=JSON.parse(fs.readFileSync(path.join(root,"config/media-runtime-2026.json"),"utf8"));
const studio=JSON.parse(fs.readFileSync(path.join(root,"config/media-studio-toolchain-2026.json"),"utf8"));
const bridge=JSON.parse(fs.readFileSync(path.join(root,"config/rechercher-omega-media-bridge-2026.json"),"utf8"));
test("full media runtime inventory is declared",()=>{
 const ids=new Set(runtime.software.map(x=>x.id));
 for(const id of ["nifi","ditto","nats","openusd","gltf","gltf-validator","real-esrgan","video2x","ffmpeg","tesseract","paddleocr","colmap","open3d","mediamtx"]) assert.ok(ids.has(id),id);
});
test("studio tooling is complete and deduplicated",()=>{
 const ids=studio.tools.map(x=>x.id);
 assert.equal(new Set(ids).size,ids.length);
 for(const id of ["kdenlive","blender","obs","ardour","audacity","gimp","inkscape","glaxnimate","imagemagick","opentimelineio","opencolorio","mlt","frei0r","mediainfo","subtitlecomposer","pipewire","openimageio","natron","flamenco","musetalk","whisperx","kokoro"]) assert.ok(ids.includes(id),id);
});
test("AI-to-media conversation bridge points to PR 602",()=>{
 assert.equal(bridge.aiBranch.pr,566);
 assert.equal(bridge.executionBranch.pr,604);
 assert.equal(bridge.executionBranch.branch,"feat/omega-media-conversation-final-2026-v3");
 for(const key of ["microphone_input","international_translation","multilingual_tts","live_voice_translation","lip_sync_dubbing","ai_media_creation","subtitle_timing"]) assert.ok(Array.isArray(bridge.taskRouting[key]),key);
});
test("runtime keeps model weights in Releases",()=>{
 assert.equal(runtime.weightsRelease.sourceOfTruth,"github-release-assets");
 assert.equal(runtime.weightsRelease.noWeightsInGit,true);
});

test("runtime keeps Video2X version-pinned without an unverified digest",()=>{
 const v=runtime.software.find(x=>x.id==="video2x");
 assert.ok(v);
 assert.equal(v.version,"6.4.0");
 assert.equal(v.image,"ghcr.io/k4yt3x/video2x:6.4.0");
 assert.equal("digest" in v,false);
});
test("headless bootstrap includes Inkscape host runtime",()=>{
 const fs2=require("node:fs");
 const boot=fs2.readFileSync("scripts/media/bootstrap-complete-runtime.sh","utf8");
 assert.match(boot,/\binkscape\b/);
});
