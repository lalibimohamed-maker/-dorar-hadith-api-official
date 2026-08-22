import test from "node:test";
import assert from "node:assert/strict";
import { getBook, getClassicalFatwaWork, getSource, listCategories, listBooks, listSources } from "../src/source-registry.js";

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

test("secondary national fatwa layer covers multiple countries", () => {
  const secondary = listSources({ category: "fatwa", secondary: true });
  for (const id of ["algeria-religious-affairs-fatwa", "egypt-dar-al-ifta", "jordan-general-ifta", "palestine-dar-ifta", "libya-dar-ifta"]) {
    assert.ok(secondary.some((source) => source.id === id));
  }
});

test("classical fatwa layer preserves Ibn Taymiyyah collections and early heritage", () => {
  const major = getClassicalFatwaWork("majmu-fatawa-ibn-taymiyyah");
  const supplement = getClassicalFatwaWork("mustadrak-majmu-fatawa-ibn-taymiyyah");
  assert.ok(major);
  assert.ok(supplement);
  assert.equal(major.authorAr, "أحمد بن عبد الحليم ابن تيمية");
  assert.equal(supplement.compilerAr, "عبد الرحمن بن محمد بن قاسم ومحمد بن عبد الرحمن بن محمد بن قاسم");
  assert.ok(getClassicalFatwaWork("mussannaf-abd-al-razzaq-fatwas"));
  assert.ok(getClassicalFatwaWork("mussannaf-ibn-abi-shaybah-fatwas"));
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

test("normalized catalog contains fiqh books and does not treat madhhabs as books", () => {
  const fiqhBooks = listBooks({ category: "fiqh" });
  assert.ok(fiqhBooks.length >= 10);
  assert.equal(fiqhBooks.some((book) => book.id === "madhhab-hanafi"), false);
  assert.ok(fiqhBooks.some((book) => book.madhhab === "hanafi"));
  assert.ok(fiqhBooks.some((book) => book.madhhab === "maliki"));
  assert.ok(fiqhBooks.some((book) => book.madhhab === "shafii"));
  assert.ok(fiqhBooks.some((book) => book.madhhab === "hanbali"));
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
