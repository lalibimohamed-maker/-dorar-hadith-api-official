/**
 * Public media publication readiness gate.
 * Every public release must pass every requested dimension.
 */
const REQUIRED = Object.freeze(["rights","provenance","quality","safety","accessibility"]);

export function evaluatePublicationReadiness({
  rights="pending",
  provenance="pending",
  quality="pending",
  safety="pending",
  accessibility="pending",
  publicRequested=true
}={}) {
  const checks={rights,provenance,quality,safety,accessibility};
  if (!publicRequested) {
    return {status:"not_requested",checks,failed:[]};
  }
  const failed=REQUIRED.filter(key=>checks[key] !== "passed");
  return {
    status: failed.length ? "blocked" : "ready",
    checks,
    failed,
    public_promotion_allowed: failed.length === 0,
    corpus_write_allowed:false,
    generated_media_is_evidence:false
  };
}

export function assertPublicationReady(result) {
  if (result?.public_promotion_allowed !== true || result.status !== "ready") {
    throw new Error("public media publication readiness gate did not pass");
  }
  return true;
}
