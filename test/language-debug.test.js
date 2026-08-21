import test from "node:test";
import assert from "node:assert/strict";
import { detectLanguage } from "../src/language.js";

test("debug French detection", () => {
  assert.equal(detectLanguage("Quelle est la source de ce hadith ?").code, "fr");
});
