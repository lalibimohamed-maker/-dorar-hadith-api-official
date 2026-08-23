import assert from "node:assert/strict";
import test from "node:test";
import { createScientificSignsProject } from "../src/quran-scientific-signs.js";

test("scientific signs video allows two additional languages", () => {
  const p = createScientificSignsProject({ topic: "الماء ودورة الماء", ayahs: ["21:30"], primaryLanguage: "ar", additionalLanguages: ["en", "fr"], scientificSources: [{ title: "Peer-reviewed source", url: "https://example.org/paper" }], religiousSources: [{ title: "Tafsir source", url: "https://example.org/tafsir" }] });
  assert.deepEqual(p.languages.additional, ["en", "fr"]);
  assert.equal(p.video.format, "mp4");
  assert.equal(p.policy.noForcedConcordism, true);
});

test("scientific signs video rejects more than two additional languages", () => {
  assert.throws(() => createScientificSignsProject({ topic: "x", ayahs: ["1:1"], primaryLanguage: "ar", additionalLanguages: ["en", "fr", "de"] }), RangeError);
});
