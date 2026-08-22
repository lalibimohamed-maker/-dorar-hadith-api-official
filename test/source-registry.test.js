import test from "node:test";
import assert from "node:assert/strict";
import { getArabicTerminologyPolicy, getBook, getClassicalFatwaWork, getSource, getTranslationPolicy, listArabicLanguageSources, listCategories, listBooks, listLanguages, listSources } from "../src/source-registry.js";

test("source registry exposes fatwa and Arabic language categories", () => {
  assert.ok(listCategories().some((item) => item.id === "fatwa"));
  assert.ok(listCategories().some((item) => item.id === "arabic-language"));
});

test("primary Arabic language layer is available", () => {
  const sources = listArabicLanguageSources();
  assert.ok(sources.length >= 5);
  assert.ok(sources.some((source) => source.id === "cairo-arabic-academy"));
  assert.ok(sources.some((source) => source.id === "cairo-quran-lexicon"));
  assert.ok(sources.some((source) => source.id === "king-salman-arabic-academy"));
  assert.ok(sources.some((source) => source.id === "quranic-arabic-corpus"));
  assert.ok(sources.every((source) => source.language === "ar"));
});

test("Arabic fiqh terminology preserves original term and prioritizes classical references", () => {
  const policy = getArabicTerminologyPolicy();
  assert.equal(policy.preserveOriginalTerm, true);
  assert.equal(policy.neverInferLegalMeaningFromModernDictionaryAlone, true);
  assert.ok(policy.sourcePriority.includes("classical-lexicons"));
  assert.ok(policy.sourcePriority.includes("fiqh-books"));
});

test("translation layer is explicitly anchored to Arabic original", () => {
  const policy = getTranslationPolicy();
  assert.equal(policy.sourceLanguage, "ar");
  assert.equal(policy.preserveOriginal, true);
  assert.ok(policy.translationTiers["official-human"]);
  assert.ok(policy.terminologySourcePriority.includes("quranic-lexicon"));
});

test("expanded fatwa sources are queryable with attribution metadata", () => {
  const sources = listSources({ category: "fatwa" });
  assert.ok(sources.length >= 10);
  assert.ok(sources.some((source) => source.id === "binbaz-official"));
  assert.ok(sources.some((source) => source.id === "binothaimeen-official"));
  assert.ok(sources.some((source) => source.id === "scholar-saad-al-shathri"));
  for (const source of sources) { assert.ok(source.url); assert.ok(source.role); }
});

test("Saudi official fatwa layer is present and institutionally separated", () => {
  const sources = listSources({ category: "fatwa", country: "السعودية" });
  assert.ok(sources.some((source) => source.id === "saudi-ifta"));
  assert.ok(sources.some((source) => source.id === "saudi-senior-scholars"));
  assert.ok(sources.some((source) => source.id === "saudi-permanent-fatwa-committee"));
  assert.equal(getSource("saudi-permanent-fatwa-committee").sourceKind, "permanent-fatwa-committee");
});

test("secondary national fatwa layer covers verified countries", () => {
  const secondary = listSources({ category: "fatwa", secondary: true });
  for (const id of ["algeria-religious-affairs-fatwa", "egypt-dar-al-ifta", "jordan-general-ifta", "palestine-dar-ifta", "libya-dar-ifta", "malaysia-mufti-federal-territories", "kuwait-government-general-fatwa"]) assert.ok(secondary.some((source) => source.id === id));
});

test("international fiqh institution is separated from national fatwa offices", () => {
  const source = getSource("international-islamic-fiqh-academy");
  assert.ok(source); assert.equal(source.category, "fiqh"); assert.equal(source.sourceKind, "international-fiqh-academy");
});

test("classical fatwa layer preserves distinct Ibn Taymiyyah collections and early heritage", () => {
  const majmu = getClassicalFatwaWork("majmu-fatawa-ibn-taymiyyah");
  const kubra = getClassicalFatwaWork("fatawa-kubra-ibn-taymiyyah");
  const supplement = getClassicalFatwaWork("mustadrak-majmu-fatawa-ibn-taymiyyah");
  assert.ok(majmu); assert.ok(kubra); assert.ok(supplement); assert.notEqual(majmu.id, kubra.id);
  assert.equal(majmu.volumes, 37); assert.equal(kubra.volumes, 6); assert.equal(supplement.volumes, 5);
  assert.equal(supplement.compilerAr, "محمد بن عبد الرحمن بن محمد بن قاسم");
});

test("multilingual layer exposes the agreed 20 languages and worldwide expansion", () => {
  const agreed20 = listLanguages({ agreed20: true });
  assert.equal(agreed20.length, 20);
  assert.ok(listLanguages().some((language) => language.code === "*"));
});

test("source IDs are unique after all registry expansions are merged", () => {
  const ids = listSources().map((source) => source.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("normalized book catalog separates compound works and madhhabs", () => {
  assert.ok(getBook("sunan-kubra-bayhaqi")); assert.ok(getBook("dalail-nubuwwa-bayhaqi"));
  assert.notEqual(getBook("sunan-kubra-bayhaqi").id, getBook("dalail-nubuwwa-bayhaqi").id);
  const fiqhBooks = listBooks({ category: "fiqh" });
  assert.ok(fiqhBooks.length >= 10); assert.equal(fiqhBooks.some((book) => book.id === "madhhab-hanafi"), false);
});

test("core hadith book sources retain distinct catalog identities", () => {
  for (const [id, nameAr] of [["bukhari","صحيح البخاري"],["muslim","صحيح مسلم"],["ahmad","مسند الإمام أحمد"],["abu-yala","مسند أبي يعلى الموصلي"],["ibn-rahwayh","مسند إسحاق بن راهويه"],["abu-dawud","سنن أبي داود"],["tirmidhi","سنن الترمذي"],["nasai","سنن النسائي"],["ibn-majah","سنن ابن ماجه"],["darimi","سنن الدارمي"]]) assert.equal(getSource(id).nameAr, nameAr);
});
