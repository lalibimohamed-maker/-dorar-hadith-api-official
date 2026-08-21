/**
 * Unified Islamic knowledge index.
 * Metadata-first: every result keeps source, work, author,
 * methodology, verification state, and rights status.
 */

export const DEFAULT_FILTERS = {
  corpus: "sunni",
  includePrimarySources: true,
  includePotentialMatches: false,
  requireSource: true,
};

export function normalizeQuery(query) {
  return String(query || "").trim().replace(/\s+/g, " ");
}

export function scoreRecord(record, query) {
  const q = normalizeQuery(query).toLowerCase();
  const fields = [record.title, record.author, record.topic, ...(record.aliases || [])]
    .filter(Boolean).join(" ").toLowerCase();
  if (!q || !fields) return 0;
  if (fields === q) return 1;
  if (fields.includes(q)) return 0.9;
  const tokens = q.split(" ").filter(Boolean);
  const hits = tokens.filter((token) => fields.includes(token)).length;
  return tokens.length ? hits / tokens.length : 0;
}

export function searchUnified(query, records = [], filters = {}) {
  const options = { ...DEFAULT_FILTERS, ...filters };
  const q = normalizeQuery(query);
  return records
    .filter((record) => !options.requireSource || Boolean(record.source))
    .filter((record) => !options.corpus || record.corpus === options.corpus)
    .filter((record) => options.includePotentialMatches || record.verification !== "potential")
    .map((record) => ({ ...record, relevance: scoreRecord(record, q) }))
    .filter((record) => record.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance);
}

export function buildEvidence(record = {}) {
  return {
    source: record.source || null,
    work: record.work || null,
    author: record.author || null,
    verification: record.verification || "unverified",
    methodology: record.methodology || null,
    rights: record.rights || "unknown",
  };
}
