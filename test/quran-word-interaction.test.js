import assert from "node:assert/strict";
import test from "node:test";
import { getWordLongPressConfig, buildWordKnowledgeRequest } from "../src/quran-word-interaction.js";

test("five second Quran word long press remains enabled", () => {
  const config = getWordLongPressConfig();
  assert.equal(config.enabled, true);
  assert.equal(config.durationMs, 5000);
  assert.equal(config.open, "word-knowledge-panel");
});

test("word knowledge panel keeps the full evidence graph", () => {
  const request = buildWordKnowledgeRequest({ word: "الملائكة", root: "ملك", surah: 2, ayah: 285, conceptId: "faith-angels" });
  assert.equal(request.type, "word-knowledge");
  assert.ok(request.sections.includes("tafsir"));
  assert.ok(request.sections.includes("hadith_and_athar"));
  assert.ok(request.sections.includes("scholarly_statements"));
  assert.ok(request.sections.includes("sources"));
  assert.equal(request.neverTreatWordAloneAsEvidence, true);
});
