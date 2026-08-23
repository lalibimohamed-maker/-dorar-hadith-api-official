import assert from "node:assert/strict";
import test from "node:test";
import { getQuranVideoConfig, validateVideoSelection, buildVideoBackgroundPrompt } from "../src/quran-video-engine.js";
import { getScientificSignsConfig, createScientificSignsProject, validateScientificVideoLanguages, classifyScientificClaim } from "../src/quran-scientific-signs.js";

test("Quran video engine supports selected ranges and MP4 export", () => {
  const c = getQuranVideoConfig();
  assert.equal(c.enabled, true);
  assert.equal(c.selection.ayahRange, true);
  assert.equal(c.selection.wholeSurah, true);
  assert.equal(c.selection.multipleSurahs, true);
  const v = validateVideoSelection({ surahs: [2], ranges: [{ start: 1, end: 10 }], reciterId: "verified-reciter", format: "mp4", resolution: "1080p" });
  assert.equal(v.ayahSync, true);
});

test("AI background prompt cannot alter Quranic text", () => {
  const p = buildVideoBackgroundPrompt("سماء ليلية هادئة مع نجوم", "sky");
  assert.equal(p.quranTextImmutable, true);
});

test("scientific signs video allows primary language plus two additional languages", () => {
  const c = getScientificSignsConfig();
  assert.equal(c.video.downloadMp4, true);
  assert.equal(c.languages.additionalLanguages, 2);
  assert.deepEqual(validateScientificVideoLanguages("ar", ["en", "fr"]), { primaryLanguage: "ar", additionalLanguages: ["en", "fr"], meaningTranslation: true });
});

test("scientific claims distinguish established evidence from hypotheses", () => {
  assert.equal(classifyScientificClaim({ status: "hypothesis" }), "speculative_do_not_present_as_fact");
  assert.equal(classifyScientificClaim({ status: "established", tafsirSupport: false }), "scientific_observation_with_separate_tafsir");
});

test("scientific signs project keeps Quran text, religious evidence and science separately attributed", () => {
  const project = createScientificSignsProject({ topic: "الماء", ayahs: ["21:30"], primaryLanguage: "ar", additionalLanguages: ["en"], scientificSources: [{ title: "peer-reviewed source" }], religiousSources: [{ title: "tafsir source" }] });
  assert.equal(project.video.format, "mp4");
  assert.equal(project.policy.noForcedConcordism, true);
  assert.equal(project.policy.tafsirSeparatedFromModernScience, true);
});
