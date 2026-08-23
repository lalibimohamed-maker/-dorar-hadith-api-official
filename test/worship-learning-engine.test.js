import assert from "node:assert/strict";
import test from "node:test";
import { buildPracticeStep, buildZakatCalculation, createLearningSession, detectWorshipTopic, getCanonicalEvidenceExamples } from "../src/worship-learning-engine.js";

test("detects core worship topics", () => {
  assert.equal(detectWorshipTopic("علمني الوضوء خطوة خطوة"), "wudu");
  assert.equal(detectWorshipTopic("كيف أصلي صلاة الجنازة؟"), "janazah");
  assert.equal(detectWorshipTopic("كيف أحسب زكاة مالي؟"), "zakat");
  assert.equal(detectWorshipTopic("ما حكم الأذان وكيفيته؟"), "adhan");
});

test("detects expanded prayer topics", () => {
  assert.equal(detectWorshipTopic("متى وقت الفجر والتغليس والإسفار؟"), "fajr_taghlees_isfar");
  assert.equal(detectWorshipTopic("كيف تصلى صلاة الكسوف؟"), "eclipse");
  assert.equal(detectWorshipTopic("متى تكون التراويح وقيام الليل؟"), "taraweeh");
  assert.equal(detectWorshipTopic("كيف أصلي صلاة المسافر بالقصر والجمع؟"), "traveler_prayer");
  assert.equal(detectWorshipTopic("ما حكم صلاة العيد؟"), "eid");
});

test("creates age-aware guided learning sessions", () => {
  const session = createLearningSession({ topic: "prayer", audience: "children", language: "fr", mode: "visual" });
  assert.equal(session.engineId, "worship-teaching");
  assert.equal(session.audience, "children");
  assert.equal(session.language, "fr");
  assert.equal(session.mode, "visual");
  assert.ok(session.modules.includes("khushu"));
});

test("requires evidence for every instructional step", () => {
  assert.throws(() => buildPracticeStep({ objective: "وضوء", instruction: "اغسل" }), /evidence/);
  const step = buildPracticeStep({ objective: "وضوء", instruction: "تعلم الخطوة", evidence: [{ source: "Sahih" }] });
  assert.equal(step.evidence.length, 1);
});

test("zakat calculator handles nisab threshold", () => {
  assert.equal(buildZakatCalculation({ assets: { cash: 1000 }, nisab: 500 }).due, 25);
  assert.equal(buildZakatCalculation({ assets: { cash: 400 }, nisab: 500 }).due, 0);
});

test("canonical evidence examples exist", () => {
  const examples = getCanonicalEvidenceExamples();
  assert.ok(examples.some((item) => item.reference === "631"));
  assert.ok(examples.some((item) => item.reference === "494"));
});
