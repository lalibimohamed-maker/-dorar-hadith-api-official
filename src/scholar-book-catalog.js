const DEFAULT_STATUS = "pending_review";

export function normalizeScholar(record = {}) {
  return {
    id: record.id ?? null,
    name: record.name ?? record.author ?? null,
    era: record.era ?? null,
    deathYear: record.deathYear ?? null,
    region: record.region ?? null,
    madhhab: record.madhhab ?? null,
    methodology: record.methodology ?? null,
    classificationStatus: record.classificationStatus ?? DEFAULT_STATUS,
    sources: Array.isArray(record.sources) ? record.sources : [],
    books: Array.isArray(record.books) ? record.books : [],
    notes: Array.isArray(record.notes) ? record.notes : []
  };
}

export function normalizeBook(record = {}) {
  return {
    id: record.id ?? null,
    title: record.title ?? null,
    authorId: record.authorId ?? null,
    subject: record.subject ?? null,
    era: record.era ?? null,
    madhhab: record.madhhab ?? null,
    methodology: record.methodology ?? null,
    formatAvailability: Array.isArray(record.formatAvailability) ? record.formatAvailability : [],
    sources: Array.isArray(record.sources) ? record.sources : [],
    rights: record.rights ?? "unknown",
    status: record.status ?? DEFAULT_STATUS
  };
}

export function searchScholarBookCatalog(records, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  return (Array.isArray(records) ? records : []).filter((item) => {
    const haystack = [
      item.name, item.author, item.title, item.subject,
      item.madhhab, item.methodology, item.era, item.region
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(q);
  });
}

export function shouldAutoIndex(record) {
  return Boolean(
    record &&
    record.sources?.length &&
    record.rights &&
    record.status === "verified"
  );
}
