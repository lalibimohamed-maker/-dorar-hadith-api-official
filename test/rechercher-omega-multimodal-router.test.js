import test from "node:test";
import assert from "node:assert/strict";
import { loadMultimodalFleet, selectMultimodalModel, buildMultimodalJob, assertMultimodalBoundary } from "../src/rechercher-omega-multimodal-router.js";

test("fleet covers video, image, audio, OCR, speech and vision", async () => {
  const fleet = await loadMultimodalFleet();
  for (const task of ["text_to_video","image_to_video","video_to_video","audio_video_generation","text_to_image","text_to_speech","speech_to_text","ocr","vision"]) {
    assert.ok(fleet.models.some(m => m.tasks.includes(task)), task);
  }
});

test("video routing selects an eligible free-first runtime model", async () => {
  const fleet = await loadMultimodalFleet();
  const plan = selectMultimodalModel({fleet,task:"text_to_video",availableRuntimes:["local","kaggle-gpu"]});
  assert.equal(plan.status,"ready");
  assert.ok(["hunyuanvideo-1.5","ltx-2","cogvideox","wan2.2"].includes(plan.model_id));
  assert.equal(plan.corpus_write_allowed,false);
});

test("uncleared weights are never promoted as production-ready", async () => {
  const fleet = await loadMultimodalFleet();
  const plan = selectMultimodalModel({fleet,task:"text_to_video",availableRuntimes:["local"],requireClearedWeights:true});
  assert.equal(plan.status,"queued");
});

test("multimodal jobs preserve provenance and Corpus boundaries", async () => {
  const fleet = await loadMultimodalFleet();
  const job = buildMultimodalJob({fleet,task:"image_to_video",input:{source_image_id:"img-1"},availableRuntimes:["kaggle-gpu"]});
  assert.doesNotThrow(() => assertMultimodalBoundary(job));
  assert.equal(job.output_policy.provenance_required,true);
  assert.equal(job.output_policy.corpus_write_allowed,false);
});
