import assert from "node:assert/strict";
import test from "node:test";
import { getQuranExperienceConfig, getReadingTheme, getQiblaConfig } from "../src/quran-experience.js";

test("Quran reading supports synchronized ayah and word highlighting", () => {
  const c = getQuranExperienceConfig();
  assert.equal(c.reading.recitation.ayahSync, true);
  assert.equal(c.reading.recitation.wordSync, true);
  assert.equal(c.reading.recitation.currentAyahHighlight, true);
  assert.equal(c.reading.recitation.currentWordHighlight, true);
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
