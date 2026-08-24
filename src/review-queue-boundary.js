import { createHash } from "node:crypto";

const TERMINAL = new Set(["approved","rejected"]);
const STATES = new Set(["pending","approved","rejected","expired"]);

function idOf(item) {
  return createHash("sha256").update(JSON.stringify({
    sourceId:item.sourceId, revisionId:item.revisionId, contentHash:item.contentHash
  })).digest("hex").slice(0,32);
}

export function createReviewItem({ sourceId, revisionId, contentHash, rights, createdAt = null } = {}) {
  if (!sourceId || !revisionId || !/^[a-f0-9]{64}$/.test(String(contentHash || ""))) {
    throw new Error("complete provenance is required");
  }
  if (!rights) throw new Error("rights status is required");
  return Object.freeze({
    schemaVersion:1, reviewId:idOf({sourceId,revisionId,contentHash}),
    sourceId, revisionId, contentHash, rights,
    state:"pending", createdAt:createdAt || new Date().toISOString(),
    decision:null
  });
}

export function decideReview(item, { decision, reviewer, reason, decidedAt = null } = {}) {
  if (!item || !STATES.has(item.state)) throw new Error("invalid review item");
  if (item.state !== "pending") throw new Error("review item is not pending");
  if (!TERMINAL.has(decision)) throw new Error("invalid decision");
  if (!reviewer || !reason) throw new Error("reviewer and reason are required");
  if (decision === "approved" && item.rights !== "redistributable") {
    throw new Error("only redistributable rights may be approved");
  }
  return Object.freeze({
    ...item, state:decision,
    decision:Object.freeze({decision, reviewer, reason, decidedAt:decidedAt || new Date().toISOString()})
  });
}

export function canEnterCorpus(item) {
  return Boolean(
    item?.state === "approved" &&
    item?.decision?.decision === "approved" &&
    item?.rights === "redistributable" &&
    item?.reviewId
  );
}
