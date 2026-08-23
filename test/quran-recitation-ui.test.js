import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ui = fs.readFileSync(new URL("../web/quran-recitation-ui.js", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../web/index.html", import.meta.url), "utf8");

test("Quran recitation UI loads as a separate browser module", () => {
  assert.match(index, /quran-recitation-ui\.js/);
  assert.match(ui, /DeenAllahQuranRecitationUI/);
  assert.match(ui, /validateSource/);
});

test("recitation UI exposes play and stop controls without TTS", () => {
  assert.match(ui, /quran-recitation-play/);
  assert.match(ui, /quran-recitation-stop/);
  assert.match(ui, /\.play\(state\.meta\)/);
  assert.match(ui, /\.stop\(\)/);
  assert.doesNotMatch(ui, /speechSynthesis/);
});

test("recitation UI displays source and reciter provenance", () => {
  assert.match(ui, /meta\.reciter/);
  assert.match(ui, /meta\.source/);
  assert.match(ui, /meta\.ayah/);
});
