import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("web/self-test.html", "utf8");
const js = fs.readFileSync("web/self-test.js", "utf8");
const bank = JSON.parse(fs.readFileSync("config/self-test-questions-2026.json", "utf8"));

test("Self-test engine has a dedicated UI and expandable question bank", () => {
  assert.match(html, /اختبر نفسك/);
  assert.match(html, /self-test\.js/);
  assert.match(html, /record/);
  assert.match(html, /qatar-tajweed/);
  assert.match(js, /getUserMedia/);
  assert.match(js, /speechSynthesis/);
  assert.match(js, /data-pronounce/);
  assert.ok(Array.isArray(bank.questions));
  assert.ok(bank.questions.length >= 10);
  assert.ok(bank.domains.some(d => d.id === "quran"));
  assert.ok(bank.domains.some(d => d.id === "hadith"));
  assert.ok(bank.domains.some(d => d.id === "fiqh"));
});

test("Every self-test question has a source and valid answer index", () => {
  for (const question of bank.questions) {
    assert.ok(question.id && question.domain && question.question);
    assert.ok(Array.isArray(question.choices) && question.choices.length >= 2);
    assert.ok(Number.isInteger(question.answer));
    assert.ok(question.answer >= 0 && question.answer < question.choices.length);
    assert.ok(question.source);
    assert.ok(question.explanation);
  }
});
