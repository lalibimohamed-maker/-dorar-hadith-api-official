const RELATION_TYPES = new Set([
  "revelation-cause",
  "revelation-context",
  "tafsir-evidence",
  "related-hadith",
  "related-sirah-event",
  "scholarly-witness",
  "inference"
]);

function clean(value) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizeLink(item) {
  if (!item || typeof item !== "object") return null;
  const type = clean(item.type);
  if (!RELATION_TYPES.has(type)) return null;
  const source = item.source && typeof item.source === "object"
    ? {
        id: clean(item.source.id),
        title: clean(item.source.title),
        locator: clean(item.source.locator),
        url: clean(item.source.url)
      }
    : null;
  if (!source?.id && !source?.title) return null;
  return {
    type,
    confidence: item.confidence === "verified" || item.confidence === "probable" ? item.confidence : "unverified",
    title: clean(item.title),
    summary: clean(item.summary),
    source
  };
}

/**
 * Build a strictly typed relationship layer without claiming that similarity
 * between a hadith/event and an ayah proves a sabab al-nuzul relationship.
 * This is intentionally a data-normalization layer; verified source records
 * are supplied by the project's source registry/indexing pipeline.
 */
export function normalizeQuranKnowledgeLinks(items = []) {
  return Array.isArray(items) ? items.map(normalizeLink).filter(Boolean) : [];
}

export function groupQuranKnowledgeLinks(items = []) {
  const links = normalizeQuranKnowledgeLinks(items);
  return {
    revelationCauses: links.filter((x) => x.type === "revelation-cause" && x.confidence === "verified"),
    revelationContexts: links.filter((x) => x.type === "revelation-context"),
    tafsirEvidence: links.filter((x) => x.type === "tafsir-evidence"),
    hadith: links.filter((x) => x.type === "related-hadith"),
    sirahEvents: links.filter((x) => x.type === "related-sirah-event"),
    scholarlyWitnesses: links.filter((x) => x.type === "scholarly-witness"),
    inferences: links.filter((x) => x.type === "inference")
  };
}

export { RELATION_TYPES };
