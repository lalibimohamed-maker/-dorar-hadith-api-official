const FAILURE_CODES = new Set([
  "permission-denied","model-missing","checksum-mismatch","license-unreviewed",
  "backend-unavailable","out-of-memory","thermal-pressure","inference-invalid","cancelled"
]);
export function validateVoiceRuntimeContract(report = {}) {
  const missing = [];
  for (const key of ["modelId","modelVersion","licenseEvidence","sha256","backend","deviceProfile","selfTest","inferenceTest"]) {
    if (report[key] === undefined || report[key] === null || report[key] === "") missing.push(key);
  }
  const valid = missing.length === 0 &&
    report.selfTest === "passed" &&
    report.inferenceTest === "passed" &&
    report.licenseReviewed === true &&
    report.checksumVerified === true;
  return Object.freeze({ valid, missing, status: valid ? "inference-verified" : "not-ready" });
}
export function normalizeVoiceFailure(code) {
  const value = String(code || "");
  return FAILURE_CODES.has(value) ? value : "backend-unavailable";
}
export function canUseRemoteVoiceBackend({ userOptIn=false, policyAllows=false, localUnavailable=false } = {}) {
  return userOptIn === true && policyAllows === true && localUnavailable === true;
}
