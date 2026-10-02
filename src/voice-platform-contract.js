const STATES = Object.freeze([
  "declared","acquiring","acquired","checksum-verified",
  "license-reviewed","loadable","loaded","inference-verified","ready"
]);

const NEXT = Object.freeze({
  declared: ["acquiring", "blocked"],
  acquiring: ["acquired", "failed"],
  acquired: ["checksum-verified", "failed"],
  "checksum-verified": ["license-reviewed", "failed"],
  "license-reviewed": ["loadable", "blocked"],
  loadable: ["loaded", "failed"],
  loaded: ["inference-verified", "failed", "unloaded"],
  "inference-verified": ["ready", "failed", "unloaded"],
  ready: ["unloaded", "failed"],
  blocked: ["acquiring"],
  failed: ["acquiring"],
  unloaded: ["loadable", "acquiring"]
});

function canTransition(from, to) {
  return Array.isArray(NEXT[from]) && NEXT[from].includes(to);
}

function requireEvidence(state, evidence = {}) {
  if (state === "checksum-verified" && evidence.sha256Verified !== true) {
    throw new Error("checksum evidence required");
  }
  if (state === "license-reviewed" && evidence.licenseReviewed !== true) {
    throw new Error("license evidence required");
  }
  if (state === "inference-verified" && evidence.realInference === false) {
    throw new Error("real inference evidence required");
  }
  if (state === "ready" &&
      (evidence.sha256Verified !== true ||
       evidence.licenseReviewed !== true ||
       evidence.realInference !== true)) {
    throw new Error("ready requires checksum, license and inference evidence");
  }
  return true;
}

function transitionRuntime(current, next, evidence) {
  if (!canTransition(current, next)) {
    throw new Error(`invalid voice runtime transition: ${current} -> ${next}`);
  }
  requireEvidence(next, evidence);
  return next;
}

function redactDiagnostics(value) {
  return JSON.parse(JSON.stringify(value, (key, val) => {
    if (/token|secret|password|authorization|api[_-]?key/i.test(key)) return "[REDACTED]";
    return val;
  }));
}

function normalizeProgress(event) {
  if (!event || typeof event !== "object") throw new Error("progress event must be an object");
  const sequence = Number(event.sequence);
  if (!Number.isInteger(sequence) || sequence < 0) throw new Error("invalid progress sequence");
  return {
    sequence,
    phase: String(event.phase || "unknown"),
    completed: Boolean(event.completed),
    ...(event.message ? {message: String(event.message)} : {})
  };
}

module.exports = {
  STATES,
  canTransition,
  requireEvidence,
  transitionRuntime,
  redactDiagnostics,
  normalizeProgress
};
