import test from "node:test";
import assert from "node:assert/strict";
import { getTajweedCurriculum, getTajweedLesson, listTajweedLessons, searchTajweedLessons } from "../src/tajweed-curriculum.js";

test("Tajweed curriculum is ordered and source-attributed", () => {
  const curriculum = getTajweedCurriculum();
  assert.equal(curriculum.id, "tajweed-academy");
  assert.ok(curriculum.lessons.length >= 10);
  assert.deepEqual(curriculum.lessons.map((lesson) => lesson.order), [...curriculum.lessons].map((lesson) => lesson.order).sort((a, b) => a - b));
  assert.equal(curriculum.contentPolicy.originalQuranTextUnchanged, true);
  assert.equal(curriculum.contentPolicy.attributionRequired, true);
  assert.ok(curriculum.sourceReferences.some((source) => source.organizationAr.includes("قطر")));
});

test("Tajweed lesson lookup and search work", () => {
  assert.equal(getTajweedLesson("letters")?.titleAr, "الحروف الهجائية");
  assert.equal(getTajweedLesson("missing"), null);
  assert.ok(searchTajweedLessons("مد").some((lesson) => lesson.id === "madd"));
  assert.equal(listTajweedLessons()[0].id, "letters");
});
