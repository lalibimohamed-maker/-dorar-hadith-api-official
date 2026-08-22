import test from "node:test";
import assert from "node:assert/strict";
import { getBook, getSource, listCategories, listBooks, listSources } from "../src/source-registry.js";

test("source registry exposes fatwa category", () => {
  const category = listCategories().find((item) => item.id === "fatwa");
  assert.ok(category);
  assert.equal(category.nameAr, "الفتاوى ومصادر العلماء");
});

test("expanded fatwa sources are queryable with attribution metadata", () => {
  const sources = listSources({ category: "fatwa" });
  assert.ok(sources.length >= 10);
  assert.ok(sources.some((source) => source.id === "binbaz-official"));
  assert.ok(sources.some((source) => source.id === "binothaimeen-official"));
  assert.ok(sources.some((source) => source.id === "scholar-saad-al-shathri"));
  for (const source of sources) {
    assert.ok(source.url);
    assert.ok(source.role);
  }
});

test("Saudi official fatwa layer is present and institutionally separated", () => {
  const sources = listSources({ category: "fatwa", country: "السعودية" });
  assert.ok(sources.some((source) => source.id === "saudi-ifta"));
  assert.ok(sources.some((source) => source.id === "saudi-senior-scholars"));
  assert.ok(sources.some((source) => source.id === "saudi-permanent-fatwa-committee"));
  assert.equal(getSource("saudi-permanent-fatwa-committee").sourceKind, "permanent-fatwa-committee");
});

test("Saudi Islamic Research Journal is research, not institutional fatwa", () => {
  const source = getSource("saudi-islamic-research-journal");
  assert.ok(source);
  assert.equal(source.category, "research");
  assert.equal(source.sourceKind, "islamic-research-journal");
});

test("source IDs are unique after all registry expansions are merged", () => {
  const sources = listSources();
  const ids = sources.map((source) => source.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("historical official sources retain availability status", () => {
  const source = getSource("alfawzan-official");
  assert.ok(source);
  assert.equal(source.url, "https://alfawzan.af.org.sa/");
  assert.equal(source.status, "historical-official-site-closed");
  assert.equal(source.closedAt, "2026-04-02");
});

test("individual expanded source retains original attribution", () => {
  const source = getSource("binbaz-official");
  assert.equal(source.scholar, "عبد العزيز بن باز");
  assert.equal(source.url, "https://binbaz.org.sa/");
  assert.equal(source.category, "fatwa");
});

test("normalized book catalog separates compound works", () => {
  assert.ok(getBook("sunan-kubra-bayhaqi"));
  assert.ok(getBook("dalail-nubuwwa-bayhaqi"));
  assert.notEqual(getBook("sunan-kubra-bayhaqi").id, getBook("dalail-nubuwwa-bayhaqi").id);
  assert.equal(getBook("sunan-kubra-bayhaqi").authorAr, "أحمد بن الحسين البيهقي");
});

test("normalized catalog does not treat madhhabs as books", () => {
  assert.equal(listBooks({ category: "fiqh" }).some((book) => book.id === "madhhab-hanafi"), false);
});

test("core hadith book sources retain distinct catalog identities", () => {
  assert.equal(getSource("bukhari").nameAr, "صحيح البخاري");
  assert.equal(getSource("muslim").nameAr, "صحيح مسلم");
  assert.equal(getSource("ahmad").nameAr, "مسند الإمام أحمد");
  assert.equal(getSource("abu-yala").nameAr, "مسند أبي يعلى الموصلي");
  assert.equal(getSource("ibn-rahwayh").nameAr, "مسند إسحاق بن راهويه");
  assert.equal(getSource("abu-dawud").nameAr, "سنن أبي داود");
  assert.equal(getSource("tirmidhi").nameAr, "سنن الترمذي");
  assert.equal(getSource("nasai").nameAr, "سنن النسائي");
  assert.equal(getSource("ibn-majah").nameAr, "سنن ابن ماجه");
  assert.equal(getSource("darimi").nameAr, "سنن الدارمي");
  assert.equal(getSource("bayhaqi").category, "hadith");
});
