import test from "node:test";
import assert from "node:assert/strict";
import { createCapabilityRouter } from "../src/rechercher-omega-capability-router.js";
import { createResourceScheduler } from "../src/rechercher-omega-resource-scheduler.js";
import { createRuntimeAdapter } from "../src/rechercher-omega-runtime-adapter.js";
import { createExecutionService } from "../src/rechercher-omega-execution-service.js";
import { createAIRouter, taskToCapability } from "../src/rechercher-omega-ai-router.js";
import { createMediaExecutionController } from "../src/rechercher-omega-media-execution-controller.js";
import { validateLifecycleTransition, prepareEngine } from "../src/rechercher-omega-model-lifecycle.js";

const identity={engine_id:"test-llm",model_id:"test-model",revision:"r1",runtime:"test-runtime",artifact:{kind:"weights",reference:"release://test",sha256:"a".repeat(64)},license:{code:"MIT",status:"verified_source_license"},rights_state:"public_allowed",activation_state:"active"};

function adapter(){return createRuntimeAdapter({runtime:"test-runtime",load:async()=>{},execute:async(task)=>({ok:true,task})});}
function registry(){return [{engine_id:"test-llm",capabilities:["reasoning"],enabled:true,identity,artifactVerified:true,licenseVerified:true}];}

test("lifecycle is fail-closed and incremental",()=>{
  assert.throws(()=>validateLifecycleTransition("registered","active"),/incremental/);
  assert.throws(()=>prepareEngine({...identity,artifact:{...identity.artifact,sha256:null}},{artifactVerified:false,licenseVerified:true}),/active engine/);
  assert.equal(prepareEngine(identity,{artifactVerified:true,licenseVerified:true}).engine_id,"test-llm");
});

test("capability router resolves normalized aliases",()=>{
  const r=createCapabilityRouter({registry:registry()});
  assert.equal(r.resolve("chat").engine_id,"test-llm");
});

test("resource scheduler refuses unavailable capacity",()=>{
  const s=createResourceScheduler([{resource_id:"cpu",enabled:true,priority:1,capacity:{memoryMB:512}}]);
  assert.throws(()=>s.select({memoryMB:1024}),/compatible/);
});

test("execution service performs preflight, load and execution",async()=>{
  const r=createCapabilityRouter({registry:registry()});
  const s=createResourceScheduler([{resource_id:"cpu",enabled:true,priority:1,capacity:{memoryMB:4096}}]);
  const e=createExecutionService({router:r,scheduler:s,adapters:{"test-runtime":adapter()}});
  const result=await e.run({job_id:"job-1",capability:"reasoning",input:"hello",resourceRequirements:{memoryMB:512}});
  assert.equal(result.state,"succeeded"); assert.equal(result.engine_id,"test-llm");
});

test("AI router maps media tasks to capabilities",()=>{assert.equal(taskToCapability({type:"pdf"}),"document-analysis");assert.equal(taskToCapability({type:"video"}),"video-generation");});

test("media controller submits through one execution boundary",async()=>{
  const r=createCapabilityRouter({registry:registry()});
  const s=createResourceScheduler([{resource_id:"cpu",enabled:true,priority:1,capacity:{memoryMB:4096}}]);
  const e=createExecutionService({router:r,scheduler:s,adapters:{"test-runtime":adapter()}});
  const c=createMediaExecutionController({execution:{execute:(x)=>e.run(x)}});
  const result=await c.generateVideo({job_id:"media-1",input:"x"});
  assert.equal(result.state,"succeeded");
});
