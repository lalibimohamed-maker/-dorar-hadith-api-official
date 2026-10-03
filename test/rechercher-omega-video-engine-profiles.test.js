import test from "node:test";
import assert from "node:assert/strict";
import { loadVideoEngineProfiles, selectVideoEngineProfile } from "../src/rechercher-omega-video-engine-profiles.js";

test("LTX-2 exposes explicit monolith and split profiles", async () => {
  const profiles = await loadVideoEngineProfiles();
  const mono = selectVideoEngineProfile({profiles,engineId:"ltx-2",profileId:"distilled-monolith"});
  const split = selectVideoEngineProfile({profiles,engineId:"ltx-2",profileId:"distilled-diffusers-split"});
  assert.equal(mono.model_revision,"dfcc2108383fe1aaa0584bdf55d368a4bdadd90c");
  assert.equal(mono.profile.external_dependency,"Gemma text encoder");
  assert.equal(split.profile.external_dependency,false);
});

test("Hunyuan exposes explicit 480p generation profiles", async () => {
  const profiles = await loadVideoEngineProfiles();
  const i2v = selectVideoEngineProfile({profiles,engineId:"hunyuanvideo-1.5",profileId:"480p-i2v-step-distilled"});
  const t2v = selectVideoEngineProfile({profiles,engineId:"hunyuanvideo-1.5",profileId:"480p-t2v-distilled"});
  assert.match(i2v.profile.transformer_asset_prefix,/480p_i2v_step_distilled/);
  assert.match(t2v.profile.transformer_asset_prefix,/480p_t2v_distilled/);
});

test("unknown profiles fail closed", async () => {
  const profiles = await loadVideoEngineProfiles();
  assert.throws(
    () => selectVideoEngineProfile({profiles,engineId:"ltx-2",profileId:"not-real"}),
    /unknown video engine profile/,
  );
});
