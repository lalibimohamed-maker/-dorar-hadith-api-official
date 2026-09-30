/**
 * Rechercher Ω — optional Orama embedded local evidence index.
 *
 * Orama is loaded only by the offline-capable application bundle.
 * No cloud/search endpoint is used here.
 */

const SCHEMA = Object.freeze({
  title: "string",
  text: "string",
  sourceId: "string",
  citation: "string",
  verificationStatus: "string"
});

function mapDocument(item, index) {
  return {
    id: String(item?.evidence_id ?? item?.id ?? item?.source_id ?? "evidence-" + index),
    title: String(item?.title ?? item?.source ?? "evidence"),
    text: String(item?.text ?? item?.text_raw ?? ""),
    sourceId: String(item?.sourceId ?? item?.source_id ?? item?.id ?? ""),
    citation: String(item?.citation ?? item?.provenance?.citation ?? ""),
    verificationStatus: String(item?.verification_status ?? item?.verification ?? "")
  };
}

export async function createOramaLocalEvidenceIndex(documents = []) {
  const { create, insert, search } = await import("@orama/orama");
  const db = create({ schema: SCHEMA });

  const sourceById = new Map();
  for (let index = 0; index < documents.length; index += 1) {
    const original = documents[index];
    const doc = mapDocument(original, index);
    if (!doc.text || !doc.sourceId || !doc.citation) continue;
    if (doc.verificationStatus !== "verified") continue;
    sourceById.set(doc.id, original);
    insert(db, doc);
  }

  return Object.freeze({
    kind: "orama-local-evidence-index",
    async searchLocal(query, { limit = 3 } = {}) {
      const result = search(db, {
        term: String(query ?? ""),
        limit: Math.max(1, Math.min(20, Number(limit) || 3))
      });

      return result.hits
        .map(hit => sourceById.get(String(hit.id)))
        .filter(Boolean);
    }
  });
}
