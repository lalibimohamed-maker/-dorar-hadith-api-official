import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configDir = path.join(__dirname, "..", "config");
const catalog = JSON.parse(fs.readFileSync(path.join(configDir, "book-catalog.json"), "utf8"));

function readJson(name, fallback) {
  const file = path.join(configDir, name);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
}

const sirahCatalog = readJson("sirah-catalog.json", { books: [], authors: [] });
const sirahSupplement = readJson("sirah-supplement.json", { books: [], authors: [] });
const verifiedSupplement = readJson("sirah-verified-supplement.json", { books: [], authors: [] });

function normalizeSirahBook(book, sourceTag) {
  const verification = book.verification || (sourceTag === "verified-supplement" ? "bibliographic-record" : "source-level");
  const status = verification === "title-verified-author-pending" ? "pending_review" : "verified";
  return {
    ...book,
    status,
    verification,
    sourceCatalog: sourceTag,
    aliases: Array.isArray(book.aliases) ? book.aliases : [],
  };
}

const books = [
  ...catalog.books,
  ...sirahCatalog.books.map((book) => normalizeSirahBook(book, "sirah-catalog")),
  ...sirahSupplement.books.map((book) => normalizeSirahBook(book, "sirah-supplement")),
  ...verifiedSupplement.books.map((book) => normalizeSirahBook(book, "verified-supplement")),
];
const authors = [...catalog.authors, ...sirahCatalog.authors, ...sirahSupplement.authors, ...verifiedSupplement.authors];

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
    verifiedSirahSupplement: verifiedSupplement.policy || null,
  };
}
