import test from "node:test";
import assert from "node:assert/strict";
import { deterministicJobId, createJob, transitionJob, assertJobBoundary } from "../src/rechercher-omega-job-control.js";
import { buildTelemetryContext, completeTelemetry, assertTelemetryPrivacy } from "../src/rechercher-omega-observability.js";
import { loadModelRegistry, selectModels, buildPlan } from "../src/rechercher-omega-orchestrator.js";
import { executeLocal } from "../src/rechercher-omega-adapters.js";
test("Omega jobs are deterministic and idempotent",()=>{
 const a=deterministicJobId({kind:"media:generation",payload:{scene_id:"s1",model:"qwen3"},revision:"1"});
 const b=deterministicJobId({kind:"media:generation",payload:{model:"qwen3",scene_id:"s1"},revision:"1"});
 assert.equal(a,b); const job=createJob({kind:"media:generation",payload:{scene_id:"s1"}});
 assert.equal(job.job_id,job.idempotency_key); assert.doesNotThrow(()=>assertJobBoundary(job));
});
test("job retries are bounded and end in dead-letter",()=>{
 let job=createJob({kind:"ai:inference",payload:{request:"x"},maxAttempts:2});
 job=transitionJob(job,"running"); job=transitionJob(job,"retryable",{retryAfterMs:5});
 job=transitionJob(job,"running"); job=transitionJob(job,"failed",{error:{type:"runtime",message:"failed"}});
 job=transitionJob(job,"dead_letter"); assert.equal(job.state,"dead_letter"); assert.equal(job.attempts,2);
});
test("telemetry defaults to metadata, not raw conversation content",()=>{
 const ctx=buildTelemetryContext({workflow:"omega.test",task:"reasoning",model_id:"qwen3"});
 const event=completeTelemetry(ctx,{status:"succeeded",latency_ms:42,input_tokens:10,output_tokens:20,provenance_id:"prov-1"});
 assert.doesNotThrow(()=>assertTelemetryPrivacy(event)); assert.equal(event.privacy.raw_prompt_recorded,false);
 assert.equal(event.privacy.raw_user_query_recorded,false); assert.equal(event.input_tokens,10);
});
test("runtime model router blocks models whose license is not runtime-cleared",async()=>{
 const registry=await loadModelRegistry();
 assert.equal(selectModels(registry,"text_to_video").every(model=>model.license_status==="verified_source_license"),true);
 const blockedPlan=buildPlan({task:"text_to_video",requested_models:["hunyuanvideo-1.5"],output_kind:"analysis"},registry);
 assert.equal(blockedPlan.status,"blocked"); assert.ok(blockedPlan.rejected_models.some(item=>item.id==="hunyuanvideo-1.5"));
});
test("local execution fails closed without an explicit executable allowlist",()=>{
 assert.throws(()=>executeLocal({command:"sh",args:["-c","echo unsafe"],allowedExecutables:[]}),/non-empty executable allowlist/);
});
test("local workers do not inherit process secrets unless explicitly requested",async()=>{
 const name="OMEGA_TEST_SECRET"; process.env[name]="must-not-cross-default-boundary";
 try {
  const {stdout}=await executeLocal({command:"node",args:["-e",`process.stdout.write(process.env[${JSON.stringify(name)}] || "missing")`],allowedExecutables:["node"]});
  assert.equal(stdout,"missing");
 } finally { delete process.env[name]; }
});
