import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ui = fs.readFileSync(new URL("../web/quran-recitation-ui.js", import.meta.url), "utf8");

test("Quran recitation UI exposes a verified reciter/edition selector", () => {
  assert.match(ui, /quran-recitation-edition/);
  assert.match(ui, /meta\.editions/);
  assert.match(ui, /item\.audioUrl/);
  assert.match(ui, /item\.source/);
  assert.match(ui, /item\.reciter/);
});

test("selector never creates unverified options", () => {
  assert.match(ui, /state\.options\.filter\(item =>/);
  assert.match(ui, /item\.qiraah === state\.qiraah/);
  assert.match(ui, /item\.riwayah === state\.riwayah/);
  assert.match(ui, /item\.audioUrl && item\.source && item\.reciter/);
});

test("Quran recitation selector remains separate from generated speech", () => {
  assert.doesNotMatch(ui, /speechSynthesis/);
  assert.doesNotMatch(ui, /SpeechSynthesisUtterance/);
});
