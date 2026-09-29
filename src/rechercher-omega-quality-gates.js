/**
 * Rechercher Ω — output quality gates.
 *
 * Measurements are supplied by trusted evaluators (e.g. VMAF/ASR/RAG
 * validators). The gate never infers quality from resolution or model name.
 */

export const DEFAULT_VIDEO_THRESHOLDS = Object.freeze({
  vmaf_min: 85,
  ssim_min: 0.95,
  subtitle_drift_ms_max: 120
});

export const DEFAULT_ANSWER_THRESHOLDS = Object.freeze({
  unsupported_claims_max: 0,
  citation_coverage_min: 1
});

function numeric(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function evaluateVideoQuality({ metrics = {}, thresholds = DEFAULT_VIDEO_THRESHOLDS } = {}) {
  const missing = [];
  if (!numeric(metrics.vmaf)) missing.push("vmaf");
  if (!numeric(metrics.ssim)) missing.push("ssim");
  if (!numeric(metrics.subtitle_drift_ms)) missing.push("subtitle_drift_ms");
  if (missing.length) return { status: "blocked", reason: "quality metrics incomplete", missing };

  const failures = [];
  if (metrics.vmaf < thresholds.vmaf_min) failures.push("vmaf_below_threshold");
  if (metrics.ssim < thresholds.ssim_min) failures.push("ssim_below_threshold");
  if (metrics.subtitle_drift_ms > thresholds.subtitle_drift_ms_max) failures.push("subtitle_drift_exceeded");
  return {
    status: failures.length ? "blocked" : "passed",
    failures,
    metrics: { vmaf: metrics.vmaf, ssim: metrics.ssim, subtitle_drift_ms: metrics.subtitle_drift_ms }
  };
}

export function evaluateAnswerQuality({ metrics = {}, thresholds = DEFAULT_ANSWER_THRESHOLDS } = {}) {
  const missing = [];
  if (!numeric(metrics.unsupported_claims)) missing.push("unsupported_claims");
  if (!numeric(metrics.citation_coverage)) missing.push("citation_coverage");
  if (missing.length) return { status: "blocked", reason: "answer quality metrics incomplete", missing };

  const failures = [];
  if (metrics.unsupported_claims > thresholds.unsupported_claims_max) failures.push("unsupported_claims_present");
  if (metrics.citation_coverage < thresholds.citation_coverage_min) failures.push("citation_coverage_below_threshold");
  return {
    status: failures.length ? "blocked" : "passed",
    failures,
    metrics: { unsupported_claims: metrics.unsupported_claims, citation_coverage: metrics.citation_coverage }
  };
}

export function assertQualityGate(result) {
  if (result?.status !== "passed") throw new Error("output quality gate did not pass");
  return true;
}
