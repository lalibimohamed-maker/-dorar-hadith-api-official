import test from "node:test";
import assert from "node:assert/strict";
import { listLocales } from "../src/i18n.js";
import { listSources } from "../src/source-registry.js";
import { getKnowledgeContext } from "../src/knowledge-context.js";
import { listSirahBooks } from "../src/sirah-catalog.js";

const AGREED_LOCALES = ["ar","en","zh","ko","bn","pl","fr","es","it","de","ru","ja","hi","fi","ber","tr","id","ms","ur","fa"];
const AGREED_EXTERNAL_SOURCE_IDS = [
  "dorar", "tafsir-app", "tadabur-app", "shamela", "bukhari", "muslim", "ahmad",
  "abu-yala", "ibn-rahwayh", "abu-dawud", "ibn-majah", "tirmidhi", "nasai", "darimi", "bayhaqi"
];

test("configured multilingual surface contains exactly the agreed 20 launch languages", () => {
  assert.deepEqual(listLocales().map((locale) => locale.code), AGREED_LOCALES);
});

test("configured source registry includes all agreed external sources", () => {
  const ids = new Set(listSources().map((source) => source.id));
  const missing = AGREED_EXTERNAL_SOURCE_IDS.filter((id) => !ids.has(id));
  assert.deepEqual(missing, [], `missing sources: ${missing.join(", ")}`);
});

test("agreed external source IDs are unique", () => {
  assert.equal(new Set(AGREED_EXTERNAL_SOURCE_IDS).size, AGREED_EXTERNAL_SOURCE_IDS.length);
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
