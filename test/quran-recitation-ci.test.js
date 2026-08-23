import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const recitation = fs.readFileSync(new URL("../web/quran-recitation.js", import.meta.url), "utf8");

test("Quran recitation engine uses native audio", () => {
  assert.match(recitation, /new Audio/);
  assert.match(recitation, /audioUrl/);
});

test("Quran recitation requires provenance fields", () => {
  assert.match(recitation, /source/);
  assert.match(recitation, /reciter/);
  assert.match(recitation, /verifiedOnly/);
});

test("Quran recitation never delegates to generated speech", () => {
  assert.doesNotMatch(recitation, /speechSynthesis/);
  assert.doesNotMatch(recitation, /SpeechSynthesisUtterance/);
});

test("Quran recitation exposes independent playback controls", () => {
  assert.match(recitation, /play/);
  assert.match(recitation, /stop/);
  assert.match(recitation, /onended/);
});
