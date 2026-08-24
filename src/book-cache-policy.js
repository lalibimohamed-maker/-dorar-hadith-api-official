export const BOOK_CACHE_STATES = Object.freeze({
  DISCOVERED: "discovered",
  VERIFIED: "verified",
  CACHED: "cached",
  BLOCKED: "blocked"
});

const ALLOWED_RIGHTS = new Set(["redistributable", "licensed", "public-domain"]);

export function evaluateBookCacheRequest({ source, provenance, rights, validation }) {
  const failures = [];

  if (!source?.id || !source?.url) failures.push("source_required");
  if (!provenance?.resourceId || !provenance?.verifiedAt) failures.push("provenance_required");
  if (!rights?.status || !ALLOWED_RIGHTS.has(rights.status)) failures.push("rights_not_verified");
  if (validation?.status !== "valid") failures.push("validation_required");

  if (failures.length) {
    return { state: BOOK_CACHE_STATES.BLOCKED, allowed: false, failures };
  }

  return {
    state: BOOK_CACHE_STATES.CACHED,
    allowed: true,
    failures: []
  };
}

export function isBookCacheSafe(request) {
  return evaluateBookCacheRequest(request).allowed;
}
