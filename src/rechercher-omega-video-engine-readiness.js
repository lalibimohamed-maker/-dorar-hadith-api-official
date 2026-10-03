/**
 * Rechercher Ω — local video-engine readiness and token/quota semantics.
 * A model may be stored without being executable. Local execution is bounded
 * by GPU/CPU/storage/rights, not by a per-video API token quota.
 */

export const VIDEO_ENGINE_STATES = Object.freeze([
  "stored_private_review",
  "runtime_packaged_unverified",
  "dependency_blocked",
  "runtime_unverified",
  "ready",
  "blocked"
]);

export function evaluateVideoEngineReadiness({
  engineId,
  localUseCleared=false,
  publicDistributionCleared=false,
  weightsPresent=false,
  revisionVerified=false,
  sha256Verified=false,
  runtimePresent=false,
  dependenciesVerified=false,
  e2eSmokeTestPassed=false,
  distributionTarget="private"
}={}) {
  if (!engineId) return {status:"blocked",reason:"engineId is required"};
  if (!localUseCleared) {
    return {
      status: distributionTarget === "private" && weightsPresent ? "stored_private_review" : "blocked",
      reason: "local use remains subject to the upstream license terms and project review",
      execution_allowed:false,
      public_distribution_allowed:Boolean(publicDistributionCleared),
      quota_required:false
    };
  }
  if (!weightsPresent) return {status:"blocked",reason:"model weights/components are not present",execution_allowed:false,public_distribution_allowed:false,quota_required:false};
  if (!revisionVerified || !sha256Verified) {
    return {status:"blocked",reason:"immutable revision and SHA-256 verification are required",execution_allowed:false,public_distribution_allowed:false,quota_required:false};
  }
  if (!runtimePresent) return {status:"blocked",reason:"runtime components are not present or verified",execution_allowed:false,public_distribution_allowed:false,quota_required:false};
  if (!dependenciesVerified) {
    return {status:"dependency_blocked",reason:"required runtime dependencies are not verified",execution_allowed:false,public_distribution_allowed:Boolean(publicDistributionCleared),quota_required:false};
  }
  if (!e2eSmokeTestPassed) {
    return {status:"runtime_unverified",reason:"end-to-end generation smoke test has not passed",execution_allowed:false,public_distribution_allowed:Boolean(publicDistributionCleared),quota_required:false};
  }
  return {
    status:"ready",
    reason:"local video engine is execution-ready",
    execution_allowed:true,
    public_distribution_allowed:Boolean(publicDistributionCleared),
    quota_required:false,
    limits:["gpu_compute","host_memory","storage","runtime_time"],
    corpus_write_allowed:false,
    generated_media_is_evidence:false
  };
}

export function assertVideoEngineExecutionReady(result) {
  if (result?.status !== "ready" || result?.execution_allowed !== true) {
    throw new Error("video engine is not execution-ready: " + (result?.reason ?? "unknown"));
  }
  if (result.quota_required) throw new Error("local video engine must not require API token quota");
  if (result.corpus_write_allowed) throw new Error("video engine cannot write to Corpus");
  return true;
}

export function localVideoExecutionContract({
  engineId,
  modelRevision,
  storageRepository,
  storageReleaseTag,
  runtime
}={}) {
  if (!engineId || !modelRevision || !storageRepository || !storageReleaseTag || !runtime) {
    throw new Error("local video execution contract requires engine, revision, storage, release and runtime");
  }
  return {
    engine_id:engineId,
    model_revision:modelRevision,
    runtime,
    storage:{repository:storageRepository,release_tag:storageReleaseTag},
    quota:{required:false,semantics:"not_applicable_to_local_weight_execution"},
    compute_budgeted:true,
    corpus_write_allowed:false,
    generated_media_is_evidence:false,
    provenance_required:true
  };
}
