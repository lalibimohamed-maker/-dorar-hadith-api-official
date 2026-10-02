const READY_EVIDENCE = new Set(["installed","loadable","inferenceVerified"]);
export function evaluateVoiceRuntimeEvidence(evidence = {}) {
  const state = {
    installed: evidence.installed === true,
    loadable: evidence.loadable === true,
    inferenceVerified: evidence.inferenceVerified === true
  };
  return Object.freeze({ ...state, ready: [...READY_EVIDENCE].every((key) => state[key]) });
}
export function selectVoiceRuntimeProfile({ memoryMb=0, thermal="nominal", preferred="quality" } = {}) {
  if (thermal === "critical" || memoryMb < 1500) return "low-power";
  if (preferred === "quality" && memoryMb >= 3000) return "quality";
  return "balanced";
}
export function isCompleteAcquisition({ bytesExpected, bytesReceived, checksumVerified=false } = {}) {
  return Number.isFinite(bytesExpected) && bytesExpected > 0 &&
    bytesReceived === bytesExpected && checksumVerified === true;
}
