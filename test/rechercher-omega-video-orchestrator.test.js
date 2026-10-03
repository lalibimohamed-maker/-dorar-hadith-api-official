import test from "node:test";
import assert from "node:assert/strict";
import { orchestrateVideoPlan } from "../src/rechercher-omega-video-orchestrator.js";

const fleet={models:[{id:"hunyuanvideo-1.5",family:"video",tasks:["text_to_video"],runtime:["kaggle-gpu"],source_revision:"9b49404b3f5df2a8f0b31df27a0c7ab872e7b038",runtime_environment_id:"hunyuanvideo15-pytorch",license_status:"cleared",local_use_status:"cleared",weight_status:"cleared",runtime_status:"ready",execution_proof:"e2e_verified",priority:1}]};
const runtimeConfig={runtimes:[{id:"kaggle-gpu",capabilities:["video_generation"]}]};

test("resolves cleared video model to free GPU",()=>{
 const plan=orchestrateVideoPlan({
   studioPlan:{research_case_id:"v1",language:"ar",scenes:[{scene_id:"s1",generation_task:"text_to_video",runtime_preferences:["kaggle-gpu"],prompt:"x",evidence_ids:["src"]}],output_policy:{corpus_write_allowed:false}},
   fleet,
   runtimeConfig,
   requireClearedWeights:true
 });
 assert.equal(plan.status,"ready"); assert.equal(plan.jobs[0].selection.model_id,"hunyuanvideo-1.5");
 assert.equal(plan.jobs[0].selection.model_revision,"9b49404b3f5df2a8f0b31df27a0c7ab872e7b038");
 assert.equal(plan.jobs[0].execution.runtime,"managed-local-video");
 assert.equal(plan.jobs[0].execution.runtime_environment_id,"hunyuanvideo15-pytorch");
});

test("queues uncleared weights",()=>{
 const plan=orchestrateVideoPlan({
   studioPlan:{research_case_id:"v2",language:"ar",scenes:[{scene_id:"s1",generation_task:"text_to_video",runtime_preferences:["kaggle-gpu"],prompt:"x",evidence_ids:["src"]}],output_policy:{corpus_write_allowed:false}},
   fleet:{models:[{id:"video-x",family:"video",tasks:["text_to_video"],runtime:["kaggle-gpu"],license_status:"review_required",weight_status:"review_required",priority:1}]},
   runtimeConfig,
   requireClearedWeights:true
 });
 assert.equal(plan.status,"queued"); assert.equal(plan.jobs[0].execution,null);
});

test("source asset keeps provenance",()=>{
 const plan=orchestrateVideoPlan({
   studioPlan:{research_case_id:"v3",language:"ar",scenes:[{scene_id:"s1",generation_task:"source_asset",evidence_ids:["src"]}],output_policy:{corpus_write_allowed:false}},
   fleet,
   runtimeConfig
 });
 assert.deepEqual(plan.jobs[0].evidence_ids,["src"]);
});

test("LTX-2 selection carries its immutable revision into the managed local job",()=>{
 const plan=orchestrateVideoPlan({
   studioPlan:{research_case_id:"v4",language:"ar",scenes:[{scene_id:"s1",generation_task:"text_to_video",runtime_preferences:["local"],prompt:"x",evidence_ids:["src"]}],output_policy:{corpus_write_allowed:false}},
   fleet:{models:[{id:"ltx-2",family:"audio_video",tasks:["text_to_video"],runtime:["local"],source_revision:"dfcc2108383fe1aaa0584bdf55d368a4bdadd90c",runtime_environment_id:"ltx2-pinned-python",license_status:"cleared",local_use_status:"cleared",weight_status:"cleared",runtime_status:"ready",execution_proof:"e2e_verified",priority:1}]},
   runtimeConfig:{runtimes:[{id:"local",capabilities:["video_generation"]}]}
 });
 assert.equal(plan.status,"ready");
 assert.equal(plan.jobs[0].selection.model_revision,"dfcc2108383fe1aaa0584bdf55d368a4bdadd90c");
 assert.equal(plan.jobs[0].execution.runtime_environment_id,"ltx2-pinned-python");
});
