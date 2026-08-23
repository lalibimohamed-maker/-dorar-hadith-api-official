import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../web/quran-recitation.js", import.meta.url), "utf8");

test("Quran recitation is a dedicated audio route", () => {
  assert.match(source, /new Audio\(meta\.audioUrl\)/);
  assert.match(source, /DeenAllahQuranRecitation/);
  assert.match(source, /isQuranRecord/);
});

test("Quran recitation requires provenance and a named reciter", () => {
  assert.match(source, /meta\.source && meta\.reciter/);
  assert.match(source, /audioUrl/);
});

test("recitation route never invokes speech synthesis", () => {
  assert.doesNotMatch(source, /speechSynthesis/);
  assert.doesNotMatch(source, /SpeechSynthesisUtterance/);
});

test("recitation can stop and resets playback state", () => {
  assert.match(source, /audio\.pause\(\)/);
  assert.match(source, /audio\.currentTime = 0/);
  assert.match(source, /state\.active = false/);
});
