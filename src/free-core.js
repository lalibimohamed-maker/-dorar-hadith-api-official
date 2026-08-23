import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listBooks, listAuthors } from "./book-catalog.js";
import { loadCorpusRecords, searchCorpus, verifyRecord } from "./corpus-index.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(root, "..", "config", "free-core-2026.json"), "utf8"));

export function getFreeCoreConfig() {
  return structuredClone(config);
}

export function listFreeCoreDomains() {
  return config.domains.map((domain) => ({ ...domain, sourceTypes: [...domain.sourceTypes] }));
}

export function listFreeCoreSources() {
  const records = loadCorpusRecords();
  const books = listBooks({ status: "verified" });
  const authors = listAuthors({ status: "verified" });
  const seen = new Set();
  const sources = [];

  for (const record of records) {
    const key = `record:${record.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({
      id: record.sourceId,
      title: record.titleOriginal,
      type: record.sourceType,
      priority: record.priority,
      status: record.reviewStatus ?? "catalogued",
      rights: record.rights ?? null
    });
  }

  for (const book of books) {
    const key = `book:${book.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({
      id: book.id,
      title: book.title,
      type: book.subject,
      priority: book.status === "verified" ? "verified-catalog" : "review",
      status: book.status,
      rights: book.rights ?? null,
      authorId: book.authorId
    });
  }

  return {
    sources,
    authorCount: authors.length,
    sourceCount: sources.length
  };
}

export function searchFreeCore(query, options = {}) {
  const results = searchCorpus(query, {
    sourceType: options.sourceType,
    verifiedOnly: options.verifiedOnly === true
  });

  return {
    query: query ?? "",
    language: options.language ?? "ar",
    aiRequired: false,
    count: results.length,
    results: results.map((record) => ({
      ...record,
      verification: verifyRecord(record)
    }))
  };
}

export function getFreeCoreSnapshot() {
  const records = loadCorpusRecords();
  const sources = listFreeCoreSources();
  return {
    name: config.name,
    version: config.version,
    requiresOpenAI: config.requiresOpenAI,
    requiresPaidAPI: config.requiresPaidAPI,
    domainCount: config.domains.length,
    corpusRecordCount: records.length,
    sourceCount: sources.sourceCount,
    authorCount: sources.authorCount,
    principles: [...config.principles]
  };
}
