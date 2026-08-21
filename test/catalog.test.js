import test from "node:test";
import assert from "node:assert/strict";
import { listAuthors, listBooks } from "../src/book-catalog.js";
import { listSources } from "../src/source-registry.js";

test("book catalog contains the requested core hadith collections", () => {
  const titles = listBooks({ subject: "hadith" }).map((book) => book.title);
  for (const title of [
    "صحيح البخاري",
    "صحيح مسلم",
    "مسند الإمام أحمد بن حنبل",
    "مسند أبي يعلى الموصلي",
    "مسند إسحاق بن راهويه",
    "سنن أبي داود",
    "سنن ابن ماجه",
    "سنن الترمذي",
    "سنن النسائي",
    "سنن الدارمي",
    "السنن الكبرى للبيهقي"
  ]) assert.ok(titles.includes(title), `missing ${title}`);
});

test("catalog exposes the four Sunni fiqh schools", () => {
  const schools = new Set(listSources({ category: "fiqh", role: "school" }).map((source) => source.id));
  assert.deepEqual(schools, new Set([
    "madhhab-hanafi",
    "madhhab-maliki",
    "madhhab-shafii",
    "madhhab-hanbali"
  ]));
});

test("verified author records are available", () => {
  assert.ok(listAuthors().length >= 10);
  assert.ok(listAuthors().every((author) => author.status === "verified"));
});
