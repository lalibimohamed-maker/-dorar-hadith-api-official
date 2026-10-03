const REQUIRED = Object.freeze([
  "modelId",
  "modelVersion",
  "licenseEvidence",
  "sha256",
  "backend",
  "deviceProfile",
  "selfTest",
  "inferenceTest",
]);

export function evaluateVoiceEvidence(report = {}) {
  const missing = REQUIRED.filter(key => report[key] === undefined || report[key] === null || report[key] === "");
  const checksumVerified = report.checksumVerified === true;
  const licenseReviewed = report.licenseReviewed === true;
  const selfTestPassed = report.selfTest === "passed";
  const inferencePassed = report.inferenceTest === "passed";
  const valid = missing.length === 0 && checksumVerified && licenseReviewed && selfTestPassed && inferencePassed;

  return Object.freeze({
    valid,
    status: valid ? "inference-verified" : "not-ready",
    missing,
    gates: Object.freeze({
      checksumVerified,
      licenseReviewed,
      selfTestPassed,
      inferencePassed,
    }),
  });
}

export function buildVoiceEvidenceRecord({
  modelId,
  modelVersion,
  licenseEvidence,
  sha256,
  backend,
  deviceProfile,
  selfTest,
  inferenceTest,
  checksumVerified = false,
  licenseReviewed = false,
  provenance = null,
} = {}) {
  const evidence = {
    modelId,
    modelVersion,
    licenseEvidence,
    sha256,
    backend,
    deviceProfile,
    selfTest,
    inferenceTest,
    checksumVerified: checksumVerified === true,
    licenseReviewed: licenseReviewed === true,
    ...(provenance ? { provenance: String(provenance) } : {}),
  };
  const evaluation = evaluateVoiceEvidence(evidence);
  return Object.freeze({ ...evidence, evaluation });
}
