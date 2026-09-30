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
function registry(){return [{engine_id:"test-llm",capabilities:["reasoning","video-generation"],enabled:true,identity,artifactVerified:true,licenseVerified:true}];}

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

test("resource scheduler queues a compatible job until capacity is released",async()=>{
  const s=createResourceScheduler([{resource_id:"cpu",enabled:true,priority:1,maxConcurrent:1,capacity:{memoryMB:4096}}]);
  const first=await s.acquire({memoryMB:512});
  let acquired=false;
  const queued=s.acquire({memoryMB:512}).then(resource=>{acquired=true;return resource;});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(acquired,false);
  s.release(first.resource_id);
  const second=await queued;
  assert.equal(second.resource_id,"cpu");
  s.release(second.resource_id);
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
  const c=createMediaExecutionController({execution:e});
  const result=await c.generateVideo({job_id:"media-1",input:"x"});
  assert.equal(result.state,"succeeded");
});


test("execution cancellation aborts the active runtime and releases the resource",async()=>{
  let releaseObserved=false;
  let resolveExecution;
  const slow=createRuntimeAdapter({
    runtime:"test-runtime",
    load:async()=>{},
    execute:async(task,{signal})=>new Promise((resolve,reject)=>{
      resolveExecution=resolve;
      signal.addEventListener("abort",()=>reject(Object.assign(new Error("execution cancelled"),{code:"ABORT_ERR"})),{once:true});
    })
  });
  const r=createCapabilityRouter({registry:registry()});
  const s=createResourceScheduler([{resource_id:"cpu",enabled:true,priority:1,capacity:{memoryMB:4096}}]);
  const e=createExecutionService({router:r,scheduler:s,adapters:{"test-runtime":slow}});
  const pending=e.run({job_id:"cancel-1",capability:"reasoning",input:"hello",resourceRequirements:{memoryMB:512}}).catch(err=>err);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(e.cancel("cancel-1"),true);
  const result=await pending;
  assert.equal(result.job.state,"cancelled");
  releaseObserved=s.list().find(x=>x.resource_id==="cpu");
  assert.equal(releaseObserved.activeJobs,0);
  assert.equal(typeof resolveExecution,"function");
});
