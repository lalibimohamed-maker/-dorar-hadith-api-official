import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export async function sha256File(path) {
  const hash = createHash("sha256");
  hash.update(await readFile(path));
  return hash.digest("hex");
}

export async function verifyWeightArtifact({ manifestEntry, path }) {
  if (!manifestEntry?.sha256) {
    return { status: "blocked", reason: "manifest SHA-256 is not populated", model_id: manifestEntry?.model_id ?? null };
  }
  const actual = await sha256File(path);
  if (actual !== manifestEntry.sha256) {
    return { status: "failed", reason: "SHA-256 mismatch", expected: manifestEntry.sha256, actual, model_id: manifestEntry.model_id };
  }
  if (manifestEntry.weight_license_status !== "cleared") {
    return { status: "blocked", reason: "weight license is not cleared", model_id: manifestEntry.model_id };
  }
  return { status: "verified", model_id: manifestEntry.model_id, sha256: actual };
}

export function assertWeightPromotion(result) {
  if (result.status !== "verified") throw new Error("model weight promotion is fail-closed: " + result.reason);
  return true;
}
