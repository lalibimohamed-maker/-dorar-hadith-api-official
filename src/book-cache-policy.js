export const BOOK_CACHE_STATES = Object.freeze({
  DISCOVERED: "discovered",
  VERIFIED: "verified",
  CACHED: "cached",
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

export function isBookCacheSafe(request) {
  return evaluateBookCacheRequest(request).allowed;
}
