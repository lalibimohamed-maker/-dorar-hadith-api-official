import assert from "node:assert/strict";
import test from "node:test";
import { getSpecializedEngines, routeSpecializedQuestion } from "../src/specialized-engines.js";

test("specialized engine registry has four required engines", () => {
  const engines = getSpecializedEngines();
  for (const id of ["sermons-lessons", "prophetic-medicine", "dua-adhkar", "worship-teaching"]) {
    assert.ok(engines.some((engine) => engine.id === id));
  }
});

test("sermon questions route to sermons engine", () => {
  assert.equal(routeSpecializedQuestion("أعد لي خطبة جمعة عن التقوى").engineId, "sermons-lessons");
});

test("prophetic medicine questions route to medicine engine", () => {
  assert.equal(routeSpecializedQuestion("ما ورد في الطب النبوي عن العسل؟").engineId, "prophetic-medicine");
});

test("dua questions route to dua engine", () => {
  assert.equal(routeSpecializedQuestion("ما دعاء الشفاء الصحيح؟").engineId, "dua-adhkar");
});

test("worship questions route to worship engine", () => {
  assert.equal(routeSpecializedQuestion("كيف أصلي صلاة الجنازة؟").engineId, "worship-teaching");
});

test("unknown questions fall back to unified evidence engine", () => {
  assert.equal(routeSpecializedQuestion("ما معنى البرزخ؟").engineId, "source-to-answer");
});
