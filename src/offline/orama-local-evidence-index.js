/**
 * Rechercher Ω — optional Orama embedded local evidence index.
 *
 * Orama is loaded only by the offline-capable application bundle.
 * No cloud/search endpoint is used here.
 *
 * Integrity contract:
 * node_id is a stable evidence identifier.
 * content_sha256 is the content digest supplied by the verified source record.
 * They are intentionally separate identifiers.
 */

const SCHEMA = Object.freeze({
  title: "string",
  text: "string",
  sourceId: "string",
  citation: "string",
  verificationStatus: "string",
  node_id: "string",
  content_sha256: "string"
});

function mapDocument(item, index) {
  return {
    id: String(item?.evidence_id ?? item?.id ?? item?.source_id ?? "evidence-" + index),
    title: String(item?.title ?? item?.source ?? "evidence"),
    text: String(item?.text ?? item?.text_raw ?? ""),
    sourceId: String(item?.sourceId ?? item?.source_id ?? item?.id ?? ""),
    citation: String(item?.citation ?? item?.provenance?.citation ?? ""),
    verificationStatus: String(item?.verification_status ?? item?.verification ?? ""),
    node_id: String(item?.node_id ?? item?.evidence_id ?? item?.id ?? "evidence-" + index),
    content_sha256: String(item?.content_sha256 ?? item?.text_hash ?? item?.sha256 ?? "")
  };
}

export async function createOramaLocalEvidenceIndex(documents = []) {
  const { create, insert, search } = await import("@orama/orama");
  const db = create({ schema: SCHEMA });

  const sourceById = new Map();
  for (let index = 0; index < documents.length; index += 1) {
    const original = documents[index];
    const doc = mapDocument(original, index);
    if (!doc.text || !doc.sourceId || !doc.citation || !doc.content_sha256) continue;
    if (doc.verificationStatus !== "verified") continue;
    sourceById.set(doc.id, {
      ...original,
      node_id: doc.node_id,
      content_sha256: doc.content_sha256,
      verification_status: doc.verificationStatus
    });
    await insert(db, doc);
  }

  return Object.freeze({
    kind: "orama-local-evidence-index",
    async searchLocal(query, { limit = 3 } = {}) {
      const result = await search(db, {
        term: String(query ?? ""),
        limit: Math.max(1, Math.min(20, Number(limit) || 3))
      });

      return result.hits
        .map(hit => sourceById.get(String(hit.id)))
        .filter(Boolean);
    }
  });
}
