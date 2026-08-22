import test from "node:test";
import assert from "node:assert/strict";
import { buildFiqhResearchTemplate, getFiqhResearchFramework, listFiqhMadhahib, searchFiqhResearch } from "../src/fiqh-research.js";

test("comparative fiqh framework exposes the four Sunni schools", () => {
  assert.deepEqual(listFiqhMadhahib().map((item) => item.id), ["hanafi", "maliki", "shafii", "hanbali"]);
});

test("requested classical scholars are represented", () => {
  const framework = getFiqhResearchFramework();
  const names = framework.classicalMethodologists.map((item) => item.nameAr);
  for (const name of [
    "أحمد بن عبد الحليم ابن تيمية",
    "محمد بن أبي بكر ابن قيم الجوزية",
    "يوسف بن عبد الله ابن عبد البر",
    "أحمد بن علي الخطيب البغدادي",
    "علي بن أحمد ابن حزم",
    "محمد الطاهر ابن عاشور"
  ]) assert.ok(names.includes(name), `missing ${name}`);
});

test("fiqh template requires evidence before a preferred view", () => {
  const template = buildFiqhResearchTemplate("حكم بيع الذهب بالآجل");
  assert.equal(template.corpus, "sunni");
  assert.ok(template.sections.some((section) => section.id === "madhhab-hanafi"));
  assert.match(template.method.preferredView, /evidence|دليل/i);
});

test("fiqh research finds Ibn Taymiyyah's fatwa works", () => {
  const results = searchFiqhResearch("ابن تيمية");
  assert.ok(results.some((item) => item.type === "scholar"));
});
