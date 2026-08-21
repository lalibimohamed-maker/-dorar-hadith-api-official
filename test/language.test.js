import test from "node:test";
import assert from "node:assert/strict";
import { detectLanguage } from "../src/language.js";

test("detects Arabic input", () => {
  assert.equal(detectLanguage("ما صحة هذا الحديث؟").code, "ar");
});

test("detects English input", () => {
  assert.equal(detectLanguage("What is this hadith about?").code, "en");
});

test("detects French input", () => {
  assert.equal(detectLanguage("Quelle est la source de ce hadith ?").code, "fr");
});

test("returns undefined for empty input", () => {
  assert.equal(detectLanguage("").code, "und");
});
