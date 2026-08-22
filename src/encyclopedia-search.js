/**
 * موسوعة دين الله — طبقة البحث والتوثيق
 * لا تجلب هذه الطبقة نصوصًا غير موثقة؛ بل تعمل على سجلات corpus التي تمر عبر بوابات التحقق.
 */

const DEFAULT_LANGUAGES = [
  "ar", "en", "fr", "es", "de", "tr", "ur", "id", "ms", "bn",
  "hi", "ru", "fa", "zh", "sw", "ha", "pt", "it", "ja", "ko"
];

const normalize = (value = "") => value
  .normalize("NFKC")
  .toLocaleLowerCase()
  .replace(/[\u064B-\u065F\u0670]/g, "")
  .replace(/[أإآٱ]/g, "ا")
  .replace(/ى/g, "ي")
  .replace(/ة/g, "ه")
  .trim();

const tokenize = (value) => normalize(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

function scoreRecord(record, query) {
  const q = normalize(query);
  const fields = [record.titleOriginal, record.textOriginal, ...(record.keywords || [])];
  const haystack = fields.map(normalize).join(" ");
  if (!q || !haystack) return 0;
  if (haystack.includes(q)) return 100;
  const tokens = tokenize(q);
  if (!tokens.length) return 0;
  return Math.round((tokens.filter((t) => haystack.includes(t)).length / tokens.length) * 80);
}

function eligible(record, options = {}) {
  if (!record || record.reviewStatus === "rejected") return false;
  if (options.sourceType && record.sourceType !== options.sourceType) return false;
  if (options.language && record.language !== options.language && record.language !== "ar") return false;
  if (options.verifiedOnly && !["source-verified", "edition-verified", "institution-verified", "scholar-reviewed", "translation-reviewed", "published"].includes(record.reviewStatus)) return false;
  return true;
}

export function searchCorpus(records, query, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
  return records
    .filter((r) => eligible(r, options))
    .map((record) => ({ record, score: scoreRecord(record, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ record, score }) => ({
      recordId: record.recordId,
      sourceId: record.sourceId,
      title: record.titleOriginal,
      sourceType: record.sourceType,
      language: record.language,
      score,
      citation: record.citation || null,
      reviewStatus: record.reviewStatus || "unknown"
    }));
}

export function verifyCitation(records, recordId) {
  const record = records.find((r) => r.recordId === recordId);
  if (!record) return { verified: false, reason: "record-not-found" };
  const citation = record.citation || {};
  const hasLocator = Object.values(citation).some(Boolean);
  const hasProvenance = Boolean(record.provenance?.sourceUrl && record.provenance?.editionOrRevision);
  return {
    verified: Boolean(hasLocator && hasProvenance && record.sourceId && record.titleOriginal),
    recordId,
    sourceId: record.sourceId,
    title: record.titleOriginal,
    citation,
    provenance: record.provenance || null,
    attribution: record.attribution || null,
    rights: record.rights || "unknown",
    reviewStatus: record.reviewStatus || "unknown"
  };
}

export function buildResearchPacket(records, query, options = {}) {
  const results = searchCorpus(records, query, options);
  const sources = results.map((r) => verifyCitation(records, r.recordId));
  return {
    query,
    language: options.language || "ar",
    claims: [],
    sources,
    conflicts: [],
    translations: [],
    verificationSummary: {
      verifiedCount: sources.filter((s) => s.verified).length,
      unverifiedCount: sources.filter((s) => !s.verified).length,
      conflictCount: 0
    }
  };
}

export { DEFAULT_LANGUAGES, normalize };
