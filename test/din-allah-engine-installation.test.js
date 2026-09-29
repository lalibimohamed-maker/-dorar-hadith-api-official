import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const manifestUrl=new URL("../config/din-allah-engine-installation-manifest-2026.json",import.meta.url);
test("complete engine inventory covers the requested engine matrix",async()=>{
 const m=JSON.parse(await fs.readFile(manifestUrl,"utf8"));
 const ids=new Set(m.engines.map(e=>e.id));
 for(const id of ["ffmpeg","ffprobe","real-esrgan","video2x","pyscenedetect","whisper","faster-whisper","whisperx","opentimelineio","blender","kdenlive","audacity","piper","kokoro","cosyvoice","qwen3","qwen3-vl","qwen3-omni","gpt-oss","ollama","llama.cpp","vllm","localai","paddleocr-vl","olmocr","deepseek-ocr","bge-m3","bge-reranker-v2-m3","qdrant"]) assert.ok(ids.has(id),"missing engine: "+id);
 for(const e of m.engines){assert.match(e.source,/^https:\/\//);assert.ok(e.license);if(e.modelRequired)assert.equal(e.modelRequired,true);}
});
test("engine policy remains fail-closed",async()=>{
 const m=JSON.parse(await fs.readFile(manifestUrl,"utf8"));
 assert.equal(m.policy.freeFirst,true);assert.equal(m.policy.noPaidCoreDependency,true);
 assert.equal(m.policy.noCorpusMutation,true);assert.equal(m.policy.noModelWeightsInGit,true);
 assert.equal(m.policy.runtimeEnabledOnlyAfterSmokeTest,true);
});