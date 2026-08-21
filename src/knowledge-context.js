import { listBooks, listAuthors } from "./book-catalog.js";
import { listSirahEvents } from "./sirah-catalog.js";

export function getKnowledgeContext({ query, verseKey } = {}) {
  const q = String(query || "").trim();
  const sirahEvents = listSirahEvents({ quranKey: verseKey, query: q }).map((event) => ({
    ...event,
    evidenceType: "sirah",
    verification: "source-linked",
  }));
  const books = listBooks({ status: "verified" }).filter((book) => {
    if (!q) return false;
    const haystack = [book.title, book.subject, book.madhhab, book.authorId, ...(book.aliases || [])]
      .filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(q.toLowerCase());
  }).slice(0, 25);
  const authors = listAuthors({ status: "verified" }).filter((author) => {
    if (!q) return false;
    return String(author.nameAr || author.name || "").toLowerCase().includes(q.toLowerCase());
  }).slice(0, 25);
  return { sirahEvents, books, authors };
}
