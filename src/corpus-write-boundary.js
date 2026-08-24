export const WRITE_DECISIONS = Object.freeze({
  ALLOW_REVIEW_QUEUE: "allow-review-queue",
  DENY_DIRECT_CORPUS_WRITE: "deny-direct-corpus-write",
  DENY_QUARANTINED: "deny-quarantined",
  DENY_UNVERIFIED: "deny-unverified"
});

const SAFE_RIGHTS = new Set(["redistributable"]);

export function authorizeCorpusWrite({ sourceId, revisionId, state, rights, actor = "source-refresh" } = {}) {
  if (!sourceId || !revisionId) return { decision: WRITE_DECISIONS.DENY_UNVERIFIED, reason: "missing-provenance" };
  if (actor !== "source-refresh") return { decision: WRITE_DECISIONS.DENY_DIRECT_CORPUS_WRITE, reason: "unexpected-writer" };
  if (state === "quarantined") return { decision: WRITE_DECISIONS.DENY_QUARANTINED, reason: "quarantined-revision" };
  if (!SAFE_RIGHTS.has(rights) || state !== "changed") {
    return { decision: WRITE_DECISIONS.ALLOW_REVIEW_QUEUE, reason: "requires-review", sourceId, revisionId };
  }
  return { decision: WRITE_DECISIONS.ALLOW_REVIEW_QUEUE, reason: "explicit-review-required", sourceId, revisionId };
}

export function isDirectCorpusWriteAllowed() {
  return false;
}
