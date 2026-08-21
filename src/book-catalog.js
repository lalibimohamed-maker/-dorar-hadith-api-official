import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configDir = path.join(__dirname, "..", "config");
const catalog = JSON.parse(fs.readFileSync(path.join(configDir, "book-catalog.json"), "utf8"));
const sirahCatalogPath = path.join(configDir, "sirah-catalog.json");
const sirahCatalog = fs.existsSync(sirahCatalogPath)
  ? JSON.parse(fs.readFileSync(sirahCatalogPath, "utf8"))
  : { books: [], authors: [] };

const books = [...catalog.books, ...sirahCatalog.books];
const authors = [...catalog.authors, ...sirahCatalog.authors];

export function listBooks({ subject, madhhab, authorId, status = "verified" } = {}) {
  return books.filter((book) =>
    (!subject || book.subject === subject) &&
    (!madhhab || book.madhhab === madhhab) &&
    (!authorId || book.authorId === authorId) &&
    (!status || book.status === status)
  );
}

export function listAuthors({ madhhab, status = "verified" } = {}) {
  return authors.filter((author) =>
    (!madhhab || author.madhhab === madhhab) &&
    (!status || author.status === status)
  );
}

export function getBook(id) {
  return books.find((book) => book.id === id) || null;
}

export function getAuthor(id) {
  return authors.find((author) => author.id === id) || null;
}

export function getBookCatalogPolicy() {
  return {
    ...catalog.policy,
    supplementarySirah: sirahCatalog.policy || null,
  };
}
