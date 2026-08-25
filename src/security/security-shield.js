import crypto from "node:crypto";

export const SECURITY_MODE = Object.freeze({
  NORMAL: "normal",
  LOCKDOWN: "lockdown"
});

export const CAPABILITY = Object.freeze({
  READ: "read",
  ANALYZE: "analyze",
  PROPOSE: "propose",
  TEST: "test",
  REVIEW: "review",
  MERGE: "merge",
  SOURCE_REFRESH: "source:refresh",
  CORPUS_WRITE: "corpus:write",
  SECRET_READ: "secret:read"
});

const RISKY_CAPABILITIES = new Set([
  CAPABILITY.MERGE,
  CAPABILITY.SOURCE_REFRESH,
  CAPABILITY.CORPUS_WRITE,
  CAPABILITY.SECRET_READ
]);

export function normalizeMode(value = process.env.SECURITY_LOCKDOWN_MODE) {
  return String(value ?? "").trim().toLowerCase() === "true"
    ? SECURITY_MODE.LOCKDOWN
    : SECURITY_MODE.NORMAL;
}

export function authorize({ mode = normalizeMode(), capabilities = [], requested }) {
  const granted = new Set(Array.isArray(capabilities) ? capabilities : []);
  if (!requested || !granted.has(requested)) {
    return { allowed: false, reason: "capability_not_granted" };
  }
  if (mode === SECURITY_MODE.LOCKDOWN && RISKY_CAPABILITIES.has(requested)) {
    return { allowed: false, reason: "lockdown_denies_high_impact_capability" };
  }
  return { allowed: true, reason: "allowed" };
}

export function hashAuditEvent(event, previousHash = "GENESIS") {
  const canonical = JSON.stringify({
    actor: String(event.actor ?? "unknown"),
    action: String(event.action ?? "unknown"),
    target: String(event.target ?? "unknown"),
    timestamp: String(event.timestamp ?? ""),
    result: String(event.result ?? "unknown"),
    previousHash
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export function createAuditEvent({ actor, action, target, result, timestamp = new Date().toISOString(), previousHash = "GENESIS" }) {
  const event = { actor, action, target, timestamp, result, previousHash };
  return { ...event, hash: hashAuditEvent(event, previousHash) };
}

/**
 * Verify an audit chain without trusting the stored hash values.
 * A single modified event, reordered event, or broken previousHash link fails closed.
 */
export function verifyAuditChain(events) {
  if (!Array.isArray(events)) return { valid: false, reason: "invalid_events" };

  let previousHash = "GENESIS";
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (!event || event.previousHash !== previousHash) {
      return { valid: false, reason: "broken_link", index };
    }
    const expectedHash = hashAuditEvent(event, previousHash);
    if (event.hash !== expectedHash) {
      return { valid: false, reason: "hash_mismatch", index };
    }
    previousHash = event.hash;
  }

  return { valid: true, reason: "valid", length: events.length, lastHash: previousHash };
}

export function detectAnomalies(events, options = {}) {
  const windowMs = Number(options.windowMs ?? 60_000);
  const maxWrites = Number(options.maxWrites ?? 20);
  const maxFailures = Number(options.maxFailures ?? 5);
  const now = Date.now();
  const recent = (Array.isArray(events) ? events : []).filter((event) => {
    const ts = Date.parse(event?.timestamp ?? "");
    return Number.isFinite(ts) && now - ts >= 0 && now - ts <= windowMs;
  });

  const writes = recent.filter((event) => /write|merge|refresh|publish/i.test(String(event.action))).length;
  const failures = recent.filter((event) => /fail|denied|rejected|error/i.test(String(event.result))).length;
  const anomalyTypes = [];
  if (writes > maxWrites) anomalyTypes.push("write_burst");
  if (failures > maxFailures) anomalyTypes.push("failure_burst");
  if (recent.some((event) => event?.result === "denied" && /secret|merge|publish/i.test(String(event.action)))) anomalyTypes.push("repeated_sensitive_denial");

  return {
    anomalous: anomalyTypes.length > 0,
    severity: anomalyTypes.includes("repeated_sensitive_denial") || failures > maxFailures ? "high" : anomalyTypes.length ? "medium" : "normal",
    types: anomalyTypes,
    observed: recent.length,
    writes,
    failures
  };
}

export function lockdownStatus(env = process.env) {
  const mode = normalizeMode(env.SECURITY_LOCKDOWN_MODE);
  return {
    mode,
    enabled: mode === SECURITY_MODE.LOCKDOWN,
    reason: env.SECURITY_LOCKDOWN_REASON || null,
    activatedAt: env.SECURITY_LOCKDOWN_ACTIVATED_AT || null
  };
}
