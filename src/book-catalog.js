import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.join(__dirname, "..", "config", "book-catalog.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

export function listBooks({ subject, madhhab, authorId, status = "verified" } = {}) {
  return catalog.books.filter((book) =>
    (!subject || book.subject === subject) &&
    (!madhhab || book.madhhab === madhhab) &&
    (!authorId || book.authorId === authorId) &&
    (!status || book.status === status)
  );
}

export function listAuthors({ madhhab, status = "verified" } = {}) {
  return catalog.authors.filter((author) =>
    (!madhhab || author.madhhab === madhhab) &&
    (!status || author.status === status)
  );
}

export function getBook(id) {
  return catalog.books.find((book) => book.id === id) || null;
}

export function getAuthor(id) {
  return catalog.authors.find((author) => author.id === id) || null;
}

export function getBookCatalogPolicy() {
  return catalog.policy;
}
