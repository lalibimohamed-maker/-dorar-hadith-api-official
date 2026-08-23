import assert from "node:assert/strict";
import test from "node:test";
import { getQuranExperienceConfig, getReadingTheme, getQiblaConfig, getReciterRegistry, getMemorizationConfig, validateMemorizationSelection } from "../src/quran-experience.js";

test("Quran reading supports synchronized ayah and word highlighting", () => {
  const c = getQuranExperienceConfig();
  assert.equal(c.reading.recitation.ayahSync, true);
  assert.equal(c.reading.recitation.wordSync, true);
  assert.equal(c.reading.recitation.currentAyahHighlight, true);
  assert.equal(c.reading.recitation.currentWordHighlight, true);
});

test("Quran supports a rights-aware reciter registry", () => {
  const recitation = getQuranExperienceConfig().reading.recitation;
  const registry = getReciterRegistry();
  assert.equal(recitation.reciterSelection, true);
  assert.equal(recitation.defaultReciter, "saad-al-ghamdi");
  assert.equal(registry.selection, true);
  assert.equal(registry.registryMode, "dynamic");
  assert.deepEqual(registry.entries, []);
});

test("memorization allows 1-20 ayahs and 1-20 repetitions", () => {
  const m = getMemorizationConfig();
  assert.equal(m.minAyahs, 1);
  assert.equal(m.maxAyahs, 20);
  assert.equal(m.minRepeats, 1);
  assert.equal(m.maxRepeats, 20);
  assert.deepEqual(validateMemorizationSelection(1, 10, 7), { startAyah: 1, endAyah: 10, ayahCount: 10, repeatCount: 7, loopMode: true });
  assert.throws(() => validateMemorizationSelection(1, 21, 1), RangeError);
  assert.throws(() => validateMemorizationSelection(1, 20, 21), RangeError);
});

test("memorization uses Qatar tajweed reference and colored rule highlighting", () => {
  const tajweed = getMemorizationConfig().tajweedOverlay;
  assert.equal(tajweed.enabled, true);
  assert.equal(tajweed.ruleHighlighting, true);
  assert.equal(tajweed.coloredLetters, true);
  assert.equal(tajweed.sourceUrl, "https://alquran.islam.gov.qa/droos/Sections.html");
  assert.equal(tajweed.useOnlyVerifiedRuleMappings, true);
});

test("light, dark and system themes are supported", () => {
  assert.equal(getReadingTheme("light"), "light");
  assert.equal(getReadingTheme("dark"), "dark");
  assert.equal(getReadingTheme("system"), "system");
});

test("Qibla uses Kaaba target and great-circle bearing", () => {
  const q = getQiblaConfig();
  assert.equal(q.target, "Kaaba_coordinates");
  assert.equal(q.calculation, "great_circle_bearing");
  assert.equal(q.sensorCalibration, true);
});
