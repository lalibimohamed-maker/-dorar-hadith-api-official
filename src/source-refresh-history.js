import { createHash } from "node:crypto";

function hash(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

export function recordRefresh(previous, observation) {
  if (!observation?.sourceId || !observation?.contentHash) throw new Error("sourceId and contentHash are required");
  const revision = {
    revisionId: hash(observation.sourceId + ":" + observation.contentHash + ":" + (observation.capturedAt || "")),
    sourceId: observation.sourceId,
    contentHash: observation.contentHash,
    capturedAt: observation.capturedAt || null,
    rights: observation.rights || "rights-unclear",
    state: observation.state || "candidate",
    parentRevisionId: previous?.revisionId || null
  };
  return Object.freeze(revision);
}

export function appendRevision(history = [], revision) {
  if (!revision?.revisionId) throw new Error("revisionId is required");
  if (history.some(x => x.revisionId === revision.revisionId)) return Object.freeze([...history]);
  return Object.freeze([...history, Object.freeze(revision)]);
}

export function latestVerified(history = []) {
  return [...history].reverse().find(x =>
    x.state === "unchanged" || x.state === "verified"
  ) || null;
}

export function canRestore(revision, history = []) {
  if (!revision?.revisionId || !history.some(x => x.revisionId === revision.revisionId)) return false;
  return revision.state === "unchanged" || revision.state === "verified";
}
