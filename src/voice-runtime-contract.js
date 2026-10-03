import { evaluateVoiceEvidence } from './voice-evidence-ledger.js';
const FAILURE_CODES = new Set([
  "permission-denied","model-missing","checksum-mismatch","license-unreviewed",
  "backend-unavailable","out-of-memory","thermal-pressure","inference-invalid","cancelled"
]);
export function validateVoiceRuntimeContract(report = {}) {
  const evaluation = evaluateVoiceEvidence(report);
  return Object.freeze({
    valid: evaluation.valid,
    missing: evaluation.missing,
    status: evaluation.status,
    gates: evaluation.gates,
  });
}
export function normalizeVoiceFailure(code) {
  const value = String(code || "");
  return FAILURE_CODES.has(value) ? value : "backend-unavailable";
}
export function canUseRemoteVoiceBackend({ userOptIn=false, policyAllows=false, localUnavailable=false } = {}) {
  return userOptIn === true && policyAllows === true && localUnavailable === true;
}
