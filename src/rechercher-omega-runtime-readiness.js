/**
 * Runtime artifact readiness is distinct from source-license/redistribution status.
 * No execution should silently assume a model weight exists on disk.
 */
export const RUNTIME_ARTIFACT_STATES = Object.freeze([
  "verified_installed",
  "verified_remote_asset",
  "download_required",
  "not_verified",
  "blocked"
]);

export function evaluateRuntimeArtifactReadiness({
  backendWeightsRequired = true,
  artifactState = "not_verified",
  sha256Verified = false,
  revisionVerified = false,
  licenseVerified = false
} = {}) {
  if (!RUNTIME_ARTIFACT_STATES.includes(artifactState)) {
    return { status: "blocked", reason: "unknown runtime artifact state" };
  }
  if (!backendWeightsRequired) return { status: "ready", reason: "backend does not require local model weights" };
  if (artifactState === "blocked") return { status: "blocked", reason: "runtime artifact is blocked" };
  if (!sha256Verified || !revisionVerified || !licenseVerified) {
    return {
      status: "blocked",
      reason: "runtime artifact requires revision, SHA-256 and license verification",
      artifact_state: artifactState,
      sha256_verified: sha256Verified,
      revision_verified: revisionVerified,
      license_verified: licenseVerified
    };
  }
  if (!["verified_installed", "verified_remote_asset"].includes(artifactState)) {
    return { status: "blocked", reason: "runtime artifact is not verified for execution" };
  }
  return {
    status: "ready",
    artifact_state: artifactState,
    sha256_verified: true,
    revision_verified: true,
    license_verified: true
  };
}

export function assertRuntimeArtifactReady(result) {
  if (result?.status !== "ready") throw new Error("runtime artifact is not execution-ready: " + (result?.reason ?? "unknown"));
  return true;
}
