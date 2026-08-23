import assert from "node:assert/strict";
import test from "node:test";
import { routeTransactionQuestion, buildTransactionLesson, listTransactionEvidence } from "../src/transactions-riba-engine.js";

test("gold-for-gold questions route to transactions engine", () => {
  const result = routeTransactionQuestion("هل بيع الذهب بالذهب يدخل في الربا؟");
  assert.equal(result.engineId, "fiqh-transactions");
  assert.equal(result.topicId, "gold_silver");
});

test("orphan wealth questions route to prohibited wealth topic", () => {
  const result = routeTransactionQuestion("ما حكم أكل مال اليتيم؟");
  assert.equal(result.engineId, "fiqh-transactions");
  assert.equal(result.topicId, "forbidden_wealth");
});

test("modern finance questions route to contract review", () => {
  const result = routeTransactionQuestion("ما حكم تمويل بنكي بصيغة مرابحة؟");
  assert.equal(result.engineId, "fiqh-transactions");
  assert.equal(result.topicId, "modern_finance_review");
});

test("transaction lessons expose structured evidence and practice", () => {
  const lesson = buildTransactionLesson("riba_basics");
  assert.equal(lesson.engineId, "fiqh-transactions");
  assert.ok(lesson.evidence.length > 0);
  assert.ok(lesson.lessons.length >= 4);
  assert.ok(lesson.lessonFlow.length >= 6);
  assert.ok(lesson.practice.length > 0);
});

test("primary hadith evidence carries verification metadata", () => {
  const evidence = listTransactionEvidence();
  const gold = evidence.find((item) => item.id === "muslimGold");
  assert.equal(gold.reference, "1587");
  assert.equal(gold.grade, "صحيح");
  assert.match(gold.url, /^https:\/\/dorar\.net\//);
});
