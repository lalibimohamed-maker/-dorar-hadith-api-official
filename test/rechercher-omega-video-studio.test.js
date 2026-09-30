import test from "node:test";
import assert from "node:assert/strict";
import {
  buildVideoStudioPlan,
  assertVideoStudioBoundary,
  buildScenePrompt
} from "../src/rechercher-omega-video-studio.js";

test("builds deterministic multi-scene video jobs with evidence provenance", () => {
  const plan = buildVideoStudioPlan({
    research_case_id:"case-001",
    script:"Reviewed educational script",
    scenes:[
      {scene_id:"s1",evidence_ids:["src-a"],visual_mode:"source_asset",generation_task:"source_asset"},
      {scene_id:"s2",evidence_ids:["src-a","src-b"],visual_mode:"generated_video",prompt:"A historical library exterior"},
      {scene_id:"s3",evidence_ids:["src-b"],visual_mode:"image_to_video",source_assets:["img-1"]}
    ]
  });
  assert.equal(plan.scenes.length,3);
  assert.equal(plan.jobs.length,3);
  assert.equal(plan.output_policy.corpus_write_allowed,false);
  assert.equal(plan.scenes[1].provenance.generated_media_is_evidence,false);
  assert.equal(assertVideoStudioBoundary(plan),true);
});

test("fails closed when a scene loses its evidence provenance", () => {
  assert.throws(() => buildVideoStudioPlan({
    research_case_id:"case-002",
    script:"Reviewed",
    scenes:[{scene_id:"s1",evidence_ids:[],visual_mode:"generated_video"}]
  }), /evidence_ids/);
});

test("rejects boundary mutation", () => {
  const plan=buildVideoStudioPlan({
    research_case_id:"case-003",
    script:"Reviewed",
    scenes:[{scene_id:"s1",evidence_ids:["src"],visual_mode:"generated_video"}]
  });
  plan.output_policy.corpus_write_allowed=true;
  assert.throws(()=>assertVideoStudioBoundary(plan),/cannot write Corpus/);
});

test("scene prompts explicitly separate evidence from generated visuals", () => {
  const prompt=buildScenePrompt({
    topic:"Hadith transmission",
    evidence_summary:"Use only reviewed source records",
    visual_goal:"animate a neutral manuscript-room illustration"
  });
  assert.match(prompt,/do not invent facts/i);
  assert.match(prompt,/generated imagery only as explanatory/i);
});
