import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import pathModule from "node:path";

export async function sha256File(path) {
  const hash = createHash("sha256");
  hash.update(await readFile(path));
  return hash.digest("hex");
}

async function verifyAcquisitionManifest({ manifestEntry, path }) {
  const verification = manifestEntry?.verification;
  if (manifestEntry.weight_license_status !== "cleared") {
    return { status: "blocked", reason: "weight license is not cleared", model_id: manifestEntry?.model_id };
  }
  if (verification?.mode !== "acquisition_artifact_manifest") {
    return { status: "blocked", reason: "unsupported acquisition verification mode", model_id: manifestEntry?.model_id };
  }

  const info = await stat(path);
  if (!info.isDirectory()) {
    return { status: "failed", reason: "acquisition manifest mode requires a directory", model_id: manifestEntry.model_id };
  }

  const root = pathModule.resolve(path);
  const acquisition = JSON.parse(await readFile(pathModule.join(root, verification.manifest_file), "utf8"));
  const listed = acquisition.files ?? [];
  if (!listed.length || !acquisition.manifest_sha256) {
    return { status: "blocked", reason: "acquisition manifest is incomplete", model_id: manifestEntry.model_id };
  }

  const canonical = listed
    .filter(item => item.path !== verification.checksum_file)
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(item => item.path + "=" + item.sha256 + "\n")
    .join("");
  const manifestDigest = createHash("sha256").update(canonical, "utf8").digest("hex");
  if (manifestDigest !== acquisition.manifest_sha256) {
    return {
      status: "failed",
      reason: "acquisition manifest SHA-256 mismatch",
      expected: acquisition.manifest_sha256,
      actual: manifestDigest,
      model_id: manifestEntry.model_id
    };
  }

  for (const item of listed) {
    if (item.path === verification.checksum_file) continue;
    const actual = await sha256File(pathModule.join(root, item.path));
    if (actual !== item.sha256) {
      return {
        status: "failed",
        reason: "artifact file SHA-256 mismatch",
        expected: item.sha256,
        actual,
        path: item.path,
        model_id: manifestEntry.model_id
      };
    }
  }

  return {
    status: "verified",
    model_id: manifestEntry.model_id,
    manifest_sha256: acquisition.manifest_sha256,
    files_verified: listed.filter(item => item.path !== verification.checksum_file).length
  };
}

export async function verifyWeightArtifact({ manifestEntry, path }) {
  if (manifestEntry?.verification?.mode === "acquisition_artifact_manifest") {
    return verifyAcquisitionManifest({ manifestEntry, path });
  }

  if (!manifestEntry?.sha256) {
    return { status: "blocked", reason: "manifest SHA-256 is not populated", model_id: manifestEntry?.model_id ?? null };
  }

  const actual = await sha256File(path);
  if (actual !== manifestEntry.sha256) {
    return {
      status: "failed",
      reason: "SHA-256 mismatch",
      expected: manifestEntry.sha256,
      actual,
      model_id: manifestEntry.model_id
    };
  }

  if (manifestEntry.weight_license_status !== "cleared") {
    return { status: "blocked", reason: "weight license is not cleared", model_id: manifestEntry.model_id };
  }

  return { status: "verified", model_id: manifestEntry.model_id, sha256: actual };
}

export function assertWeightPromotion(result) {
  if (result.status !== "verified") {
    throw new Error("model weight promotion is fail-closed: " + result.reason);
  }
  return true;
}
