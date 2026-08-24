import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const catalog = JSON.parse(fs.readFileSync(new URL("../data/quran-knowledge-catalog.json", import.meta.url), "utf8"));

test("Quran knowledge catalog keeps Quran learning categories separate", () => {
  assert.deepEqual(catalog.categories.map((item) => item.id), ["tafsir", "tadabbur", "visual-learning", "collective-fiqh"]);
});

test("catalog includes the requested seed works", () => {
  const titles = catalog.categories.flatMap((category) => category.seedWorks.map((work) => work.title));
  for (const title of [
    "جامع البيان عن تأويل آي القرآن",
    "تفسير القرآن العظيم",
    "تيسير الكريم الرحمن في تفسير كلام المنان",
    "تفسير الجلالين",
    "التفسير الميسر",
    "التفسير الوسيط للقرآن الكريم",
    "القرآن تدبر وعمل",
    "هدايات القرآن الكريم",
    "جعلناه نورا",
    "الفقه الميسر في ضوء الكتاب والسنة"
  ]) assert.ok(titles.includes(title), title);
});

test("every catalog item has provenance planning metadata", () => {
  for (const category of catalog.categories) {
    for (const work of category.seedWorks) {
      assert.ok(work.title);
      assert.ok(work.status);
      assert.ok(work.sourceTier);
    }
  }
});

test("full-text ingestion is gated by rights verification", () => {
  assert.equal(catalog.policy.sourcePriority[0], "official");
  assert.equal(catalog.policy.secondarySourcesAreDiscoveryOnly, true);
  assert.match(catalog.policy.ingestionRule, /rights/i);
});
