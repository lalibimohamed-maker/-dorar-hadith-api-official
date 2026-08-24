import { createHash } from "node:crypto";

export const REFRESH_STATE = Object.freeze({
  unchanged: "unchanged",
  candidate: "candidate",
  changed: "changed",
  quarantined: "quarantined"
});

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

export function inspectSourceRefresh({ sourceId, sourceUrl, previousHash = null, fetchedContent = null, rights = "rights-unclear", capturedAt = null } = {}) {
  if (!sourceId || !sourceUrl) throw new Error("sourceId and sourceUrl are required");
  if (fetchedContent == null) return Object.freeze({ sourceId, sourceUrl, state: REFRESH_STATE.candidate, reason: "no-content-captured" });

  const nextHash = sha256(fetchedContent);
  const unchanged = previousHash && previousHash === nextHash;
  if (unchanged) {
    return Object.freeze({ sourceId, sourceUrl, state: REFRESH_STATE.unchanged, previousHash, nextHash, capturedAt });
  }

  const state = rights === "redistributable" ? REFRESH_STATE.changed : REFRESH_STATE.quarantined;
  return Object.freeze({
    sourceId, sourceUrl, state, previousHash, nextHash, capturedAt,
    rights,
    requiresReview: true,
    rule: "refresh-never-overwrites-authoritative-data"
  });
}

export function canApplyRefresh(result = {}) {
  return result.state === REFRESH_STATE.changed &&
    result.rights === "redistributable" &&
    result.requiresReview === true;
}
