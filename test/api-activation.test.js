import test from "node:test";
import assert from "node:assert/strict";
import { apiActivation, apiActivationReady } from "../src/api-activation.js";

test("API activation registry exposes lifecycle states", () => {
  const qf = apiActivation("quran-foundation");
  assert.equal(qf.runtime, true);
  assert.equal(qf.rechercher, true);
  assert.equal(qf.acquisition, false);
});

test("Sunnah.com is registered as a runtime connector without automatic acquisition", () => {
  const sunnah = apiActivation("sunnah-com");
  assert.equal(sunnah.runtime, true);
  assert.equal(sunnah.rechercher, true);
  assert.equal(sunnah.acquisition, false);
  assert.equal(apiActivationReady("sunnah-com", "verification"), true);
});


test("HadeethEnc is fully activated through the governed lifecycle", () => {
  const h = apiActivation("hadeethenc-api");
  for (const stage of ["registered","implemented","runtime","rechercher","verification","acquisition","release","search_encyclopedia"]) assert.equal(h[stage], true);
  assert.equal(h.auth, "public-api");
  assert.equal(h.capabilities.includes("hadith-record"), true);
});
