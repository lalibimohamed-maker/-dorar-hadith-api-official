import assert from "node:assert/strict";
import test from "node:test";
import { getSpecializedEngines, routeSpecializedQuestion } from "../src/specialized-engines.js";

test("specialized engine registry includes the required learning and answer engines", () => {
  const engines = getSpecializedEngines();
  for (const id of ["sermons-lessons", "prophetic-medicine", "dua-adhkar", "worship-teaching", "fiqh-transactions", "quran-learning", "islamic-tools", "source-to-answer"]) assert.ok(engines.some((engine) => engine.id === id));
});
test("sermon questions route to sermons engine", () => assert.equal(routeSpecializedQuestion("أعد لي خطبة جمعة عن التقوى").engineId, "sermons-lessons"));
test("prophetic medicine questions route to medicine engine", () => assert.equal(routeSpecializedQuestion("ما ورد في الطب النبوي عن العسل؟").engineId, "prophetic-medicine"));
test("dua questions route to dua engine", () => assert.equal(routeSpecializedQuestion("ما دعاء الشفاء الصحيح؟").engineId, "dua-adhkar"));
test("worship questions route to worship engine", () => assert.equal(routeSpecializedQuestion("كيف أصلي صلاة الجنازة؟").engineId, "worship-teaching"));
test("prayer variant questions route to worship engine", () => {
  for (const q of ["متى صلاة الفجر والتغليس؟", "ما حكم صلاة الكسوف؟", "كيف أصلي صلاة المسافر بالقصر؟", "متى صلاة التراويح وقيام الليل؟", "ما حكم صلاة العيد للمرأة?"]) assert.equal(routeSpecializedQuestion(q).engineId, "worship-teaching");
});
test("riba and transaction questions route to transactions engine", () => {
  for (const q of ["ما الربا؟", "هل بيع الذهب بالذهب فيه ربا؟", "ما حكم فوائد القرض؟", "ما حكم أكل مال اليتيم؟", "ما هو الغرر في البيع؟", "هل يجوز أن أبيع ما ليس عندي؟", "ما حكم الغش في البيع؟", "هل القمار من المعاملات المحرمة؟"]) assert.equal(routeSpecializedQuestion(q).engineId, "fiqh-transactions");
});
test("بيع ما ليس عندي uses deterministic transaction routing", () => {
  for (const q of ["هل يجوز أن أبيع ما ليس عندي؟", "ما حكم بيع ما ليس عندي؟", "ما حكم بيع ما ليس عندك؟"]) {
    const result = routeSpecializedQuestion(q);
    assert.equal(result.engineId, "fiqh-transactions");
    assert.equal(result.confidence, 1);
  }
});
test("funeral sermon questions still route to sermons engine", () => assert.equal(routeSpecializedQuestion("أعد لي موعظة جنازة عن الصبر").engineId, "sermons-lessons"));
test("specific worship concepts beat generic funeral aliases", () => { const result = routeSpecializedQuestion("كيف أصلي صلاة الميت؟"); assert.equal(result.engineId, "worship-teaching"); assert.ok(result.candidates.some((candidate) => candidate.id === "sermons-lessons")); });
test("Quran learning questions route to Quran learning engine", () => assert.equal(routeSpecializedQuestion("كيف أتعلم التجويد؟").engineId, "quran-learning"));
test("Islamic tool questions route to tools engine", () => assert.equal(routeSpecializedQuestion("ما اتجاه القبلة ومواقيت الصلاة؟").engineId, "islamic-tools"));
test("unknown questions fall back to unified evidence engine", () => assert.equal(routeSpecializedQuestion("ما معنى البرزخ؟").engineId, "source-to-answer"));
