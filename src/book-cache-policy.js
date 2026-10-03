export const BOOK_CACHE_STATES = Object.freeze({
  DISCOVERED: "discovered",
  VERIFIED: "verified",
  CACHED: "cached",
  BLOCKED: "blocked"
});

export const BOOK_SOURCE_CONNECTOR_STATES = Object.freeze({
  ELIGIBLE: "eligible",
  BLOCKED: "blocked"
});

const ALLOWED_RIGHTS = new Set(["redistributable", "licensed", "public-domain"]);

function hasIdentity(value, keys) {
  return Boolean(
    value &&
    keys.every((key) => {
      const field = value[key];
      return typeof field === "string" && field.trim();
    })
  );
}

function hasVerifiedAt(value) {
  if (typeof value?.verifiedAt !== "string" || !value.verifiedAt.trim()) return false;
  return Number.isFinite(Date.parse(value.verifiedAt));
}

function hasSourceUrl(source) {
  if (!hasIdentity(source, ["id", "url"])) return false;
  try {
    const parsed = new URL(source.url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function evaluateBookCacheRequest({ source, provenance, rights, validation } = {}) {
  const failures = [];

  if (!hasSourceUrl(source)) failures.push("source_required");
  if (!hasIdentity(provenance, ["resourceId"]) || !hasVerifiedAt(provenance)) failures.push("provenance_required");
  if (!rights?.status || !ALLOWED_RIGHTS.has(String(rights.status))) failures.push("rights_not_verified");
  if (!["valid", "passed"].includes(String(validation?.status || ""))) failures.push("validation_required");

  if (failures.length) {
    return Object.freeze({
      state: BOOK_CACHE_STATES.BLOCKED,
      allowed: false,
      failures
    });
  }

  return Object.freeze({
    state: BOOK_CACHE_STATES.CACHED,
    allowed: true,
    failures: [],
    gates: Object.freeze(["source", "provenance", "rights", "validation"]),
    policy: Object.freeze({
      authorityLayer: false,
      corpusMutation: false,
      discoveryIsRightsEvidence: false,
      futureOcrStorageIndexingExportMustRecheck: true
    })
  });
}

/**
 * Contract-only qualification for future book fetching.
 * This function performs no HTTP, OCR, storage, indexing, or corpus mutation.
 */
export function evaluateBookSourceConnector({ resourceId, source, provenance, rights, validation } = {}) {
  const normalizedProvenance = resourceId && provenance
    ? { ...provenance, resourceId: provenance.resourceId || resourceId }
    : provenance;

  const result = evaluateBookCacheRequest({
    source,
    provenance: normalizedProvenance,
    rights,
    validation
  });

  if (!result.allowed || !resourceId) {
    const failures = [...(result.failures || [])];
    if (!resourceId && !failures.includes("resource_id_required")) failures.unshift("resource_id_required");
    return Object.freeze({
      state: BOOK_SOURCE_CONNECTOR_STATES.BLOCKED,
      allowed: false,
      failures,
      fetchAllowed: false,
      contractOnly: true,
      rightsGrant: false,
      networkFetchPerformed: false,
      ocrPerformed: false,
      storagePerformed: false,
      indexingPerformed: false,
      corpusMutation: false
    });
  }

  return Object.freeze({
    state: BOOK_SOURCE_CONNECTOR_STATES.ELIGIBLE,
    allowed: true,
    failures: [],
    resourceId,
    source,
    provenance: normalizedProvenance,
    rights,
    validation,
    fetchAllowed: true,
    contractOnly: true,
    rightsGrant: false,
    networkFetchPerformed: false,
    ocrPerformed: false,
    storagePerformed: false,
    indexingPerformed: false,
    corpusMutation: false
  });
}

export function isBookSourceConnectorEligible(request) {
  return evaluateBookSourceConnector(request).allowed;
}

export function isBookCacheSafe(request) {
  return evaluateBookCacheRequest(request).allowed;
}
