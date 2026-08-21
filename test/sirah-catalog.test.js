import test from "node:test";
import assert from "node:assert/strict";
import { getSirahBook, listSirahBooks, listSirahEvents } from "../src/sirah-catalog.js";

test("sirah catalog includes core source-analysis works", () => {
  const books = listSirahBooks();
  assert.ok(books.some((book) => book.id === "zad-al-maad"));
  assert.ok(books.some((book) => book.id === "al-bidaya-sirah"));
  assert.ok(books.some((book) => book.id === "tabaqat-ibn-saad-sirah"));
});

test("sirah event catalog links Quran keys without declaring revelation cause", () => {
  const events = listSirahEvents({ quranKey: "48:18" });
  assert.ok(events.some((event) => event.id === "hudaybiyyah"));
  assert.equal(getSirahBook("al-maghazi-al-waqidi").verification, "historical-source-requires-hadith-level-verification");
});
