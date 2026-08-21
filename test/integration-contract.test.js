import test from "node:test";
import assert from "node:assert/strict";
import { listLocales } from "../src/i18n.js";
import { listSources } from "../src/source-registry.js";
import { getKnowledgeContext } from "../src/knowledge-context.js";
import { listSirahBooks } from "../src/sirah-catalog.js";

test("configured multilingual surface includes the agreed languages", () => {
  const codes = new Set(listLocales().map((locale) => locale.code));
  for (const code of ["ar", "en", "fr", "es", "it", "de", "ru", "ja", "hi", "fi", "ber"]) {
    assert.ok(codes.has(code), `missing locale ${code}`);
  }
});

test("configured source registry includes the agreed external sources", () => {
  const ids = new Set(listSources().map((source) => source.id));
  for (const id of ["dorar", "tafsir-app", "tadabur-app", "shamela", "bukhari", "muslim", "ahmad", "abu-yala", "ibn-rahwayh", "abu-dawud", "ibn-majah", "tirmidhi", "nasai", "darimi", "bayhaqi"]) {
    assert.ok(ids.has(id), `missing source ${id}`);
  }
});

test("sirah catalog has supplementary verified source metadata", () => {
  const books = listSirahBooks();
  assert.ok(books.some((book) => book.id === "zad-al-maad"));
  assert.ok(books.some((book) => book.id === "al-maghazi-al-waqidi"));
});

test("knowledge context keeps source-oriented records", () => {
  const context = getKnowledgeContext({ query: "الحديث" });
  assert.ok(Array.isArray(context.books));
  assert.ok(Array.isArray(context.authors));
  assert.ok(Array.isArray(context.sirahEvents));
});
