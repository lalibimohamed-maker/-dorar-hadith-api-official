import assert from "node:assert/strict";
import test from "node:test";
import { validateBackground } from "../src/quran-video-studio.js";

test("AI Quran video backgrounds require a prompt", () => {
  assert.equal(validateBackground({ type: "ai-image", prompt: "سماء ليلية هادئة بطابع إسلامي" }), true);
  assert.throws(() => validateBackground({ type: "ai-image" }), /وصف الخلفية/);
});

test("scientific video backgrounds require a source", () => {
  assert.equal(validateBackground({ type: "scientific", sourceUrl: "https://example.org/source" }), true);
  assert.throws(() => validateBackground({ type: "scientific" }), /مصدرًا/);
});
