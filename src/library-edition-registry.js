import { createHash } from "node:crypto";

export const CACHE_POLICY = Object.freeze({
  immutable: "immutable",
  reference: "reference",
  quarantine: "quarantine"
});

function digest(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

/**
 * Metadata-only edition registry.
 * It stores provenance/integrity metadata, not copyrighted book bytes.
 * Protected sources remain reference-only unless rights are explicit.
 */
export function createEditionRecord(input = {}) {
  const sourceUrl = String(input.sourceUrl || "").trim();
  const contentHash = String(input.contentHash || "").trim().toLowerCase();
  if (!sourceUrl) throw new Error("sourceUrl is required");
  if (!/^[a-f0-9]{64}$/.test(contentHash)) throw new Error("contentHash must be SHA-256");

  const rights = input.rights || "rights-unclear";
  const policy = rights === "redistributable" ? CACHE_POLICY.immutable :
    rights === "link-only" || rights === "read-only" || rights === "read-copy" ? CACHE_POLICY.reference :
    CACHE_POLICY.quarantine;

  return Object.freeze({
    schemaVersion: 1,
    editionId: input.editionId || digest(sourceUrl + ":" + contentHash).slice(0, 24),
    sourceUrl,
    contentHash,
    rights,
    policy,
    capturedAt: input.capturedAt || new Date().toISOString(),
    sourceId: input.sourceId || null,
    licenseEvidence: input.licenseEvidence || null
  });
}

export function canPersistBytes(record) {
  return record?.policy === CACHE_POLICY.immutable && record?.rights === "redistributable";
}

export function canPersistReference(record) {
  return record?.policy === CACHE_POLICY.reference && Boolean(record?.sourceUrl);
}

export function isIntegrityMatch(record, bytes) {
  return Boolean(record?.contentHash) && digest(bytes) === record.contentHash;
}
