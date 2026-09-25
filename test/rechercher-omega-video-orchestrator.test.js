import test from "node:test";
import assert from "node:assert/strict";
import { orchestrateVideoPlan } from "../src/rechercher-omega-video-orchestrator.js";

const fleet={models:[{id:"hunyuanvideo-1.5",family:"video",tasks:["text_to_video"],runtime:["kaggle-gpu"],license_status:"cleared",weight_status:"cleared",priority:1}]};
const runtimeConfig={runtimes:[{id:"kaggle-gpu",capabilities:["video_generation"]}]};

test("resolves cleared video model to free GPU",()=>{
 const plan=orchestrateVideoPlan({
   studioPlan:{research_case_id:"v1",language:"ar",scenes:[{scene_id:"s1",generation_task:"text_to_video",runtime_preferences:["kaggle-gpu"],prompt:"x",evidence_ids:["src"]}],output_policy:{corpus_write_allowed:false}},
   fleet,
   runtimeConfig,
   requireClearedWeights:true
 });
 assert.equal(plan.status,"ready"); assert.equal(plan.jobs[0].selection.model_id,"hunyuanvideo-1.5");
 assert.equal(plan.jobs[0].execution.runtime,"kaggle-gpu");
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
