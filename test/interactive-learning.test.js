import assert from "node:assert/strict";
import test from "node:test";
import {
  getInteractiveLearningCatalog,
  getWorshipModule,
  resolveLearningIntent,
  buildLearningLesson,
  calculateQiblaBearing,
  calculateZakat2Point5
} from "../src/interactive-learning.js";

test("interactive catalog includes the worship curriculum", () => {
  const catalog = getInteractiveLearningCatalog();
  assert.equal(catalog.project, "موسوعة دين الله");
  assert.ok(catalog.worship.length >= 15);
  assert.equal(catalog.quranLearning.officialQatarCurriculum.length, 3);
});

test("learning intent resolves common worship questions", () => {
  assert.equal(resolveLearningIntent("كيف أصلي صلاة الجنازة؟")?.id, "funeral-prayer");
  assert.equal(resolveLearningIntent("كيف أتوضأ؟")?.id, "wudu");
  assert.equal(resolveLearningIntent("ما حكم سجود السهو؟")?.id, "sujud-sahw");
});

test("lesson output keeps evidence status attached to every step", () => {
  const lesson = buildLearningLesson("prophetic-prayer");
  assert.equal(lesson.engineId, "worship-teaching");
  assert.ok(lesson.steps.length >= 5);
  assert.ok(lesson.steps.every((step) => step.evidenceStatus));
});

test("qibla bearing points from a known location toward Makkah", () => {
  const bearing = calculateQiblaBearing(21.422487, 39.826206);
  assert.ok(Number.isFinite(bearing));
  assert.ok(bearing >= 0 && bearing < 360);
});

test("zakat educational calculator uses 2.5 percent only when eligible and over nisab", () => {
  assert.equal(calculateZakat2Point5({ base: 10000, nisab: 5000, eligible: true }).due, 250);
  assert.equal(calculateZakat2Point5({ base: 10000, nisab: 5000, eligible: false }).due, 0);
});

test("known module remains directly addressable", () => {
  assert.equal(getWorshipModule("zakat-fitr").nameAr, "زكاة الفطر");
});
