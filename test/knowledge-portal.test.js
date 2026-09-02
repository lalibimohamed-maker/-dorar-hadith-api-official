import test from "node:test";
import assert from "node:assert/strict";
import { getKnowledgePortal, getKnowledgeCapability, listKnowledgeCapabilities, portalSourcePolicy } from "../src/knowledge-portal.js";

test("portal exposes the major knowledge domains", () => {
  const portal = getKnowledgePortal();
  for (const key of ["quran", "sunnah", "research", "education", "lifeTools", "media", "provenance"]) {
    assert.ok(portal.capabilities[key], `missing portal capability: ${key}`);
  }
});

test("portal keeps Quran study layers distinct", () => {
  const quran = getKnowledgeCapability("quran");
  assert.equal(quran.domain, "quran");
  assert.equal(quran.value, undefined);
  assert.equal(quran.reader, "/quran/ayah");
  assert.equal(quran.studyMode, true);
  assert.equal(quran.wordByWord, true);
  assert.match(String(quran.tafsir), /Tafsir/);
});

test("portal provenance policy is explicit", () => {
  const policy = portalSourcePolicy();
  assert.ok(policy.provenance.requiredFields.includes("sourceUrl"));
  assert.ok(policy.provenance.requiredFields.includes("sha256"));
  assert.equal(policy.provenance.statusValues.includes("rights-restricted"), true);
});

test("portal capability listing is stable and non-empty", () => {
  const list = listKnowledgeCapabilities();
  assert.ok(list.length >= 7);
  assert.ok(list.some((item) => item.id === "quran"));
  assert.ok(list.some((item) => item.id === "lifeTools"));
});
