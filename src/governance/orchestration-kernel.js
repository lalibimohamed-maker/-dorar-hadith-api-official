import { authorize, CAPABILITY } from "../security/security-shield.js";

const ALLOWED_ACTIONS = new Set([
  "read", "discover", "transform", "write", "publish", "export"
]);

const DEFAULT_POLICY = Object.freeze({
  requireProvenance: true,
  requireRightsForPublish: true,
  requireValidationForWrite: true,
  allowSearchAsEvidence: false,
  failClosed: true
});

const ACTION_CAPABILITY = Object.freeze({
  read: CAPABILITY.READ,
  discover: CAPABILITY.ANALYZE,
  transform: CAPABILITY.ANALYZE,
  write: CAPABILITY.CORPUS_WRITE,
  publish: CAPABILITY.MERGE,
  export: CAPABILITY.PROPOSE
});

export class GovernanceBlockedError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GovernanceBlockedError";
    this.code = code;
  }
}

export function validateOperation(operation, policy = DEFAULT_POLICY) {
  if (!operation || typeof operation !== "object") {
    throw new GovernanceBlockedError("INVALID_OPERATION", "Operation must be an object");
  }

  const action = operation.action;
  if (!ALLOWED_ACTIONS.has(action)) {
    throw new GovernanceBlockedError("ACTION_NOT_ALLOWED", `Unsupported action: ${action}`);
  }

  const capability = ACTION_CAPABILITY[action];
  const capabilities = Array.isArray(operation.capabilities) ? operation.capabilities : [];
  const authorization = authorize({ capabilities, requested: capability });
  if (!authorization.allowed) {
    throw new GovernanceBlockedError("SECURITY_CAPABILITY_DENIED", authorization.reason);
  }

  if (policy.requireProvenance && !operation.provenance) {
    throw new GovernanceBlockedError("PROVENANCE_REQUIRED", "Provenance is required");
  }

  if (action === "write" || action === "publish" || action === "export") {
    if (policy.requireValidationForWrite && operation.validation?.status !== "passed") {
      throw new GovernanceBlockedError("VALIDATION_REQUIRED", "A passed validation result is required");
    }
  }

  if ((action === "publish" || action === "export") && policy.requireRightsForPublish) {
    if (!operation.rights || !["redistributable", "licensed", "public-domain"].includes(operation.rights.status)) {
      throw new GovernanceBlockedError("RIGHTS_REQUIRED", "Redistribution rights are not verified");
    }
  }

  if (operation.sourceKind === "search-result" && !policy.allowSearchAsEvidence) {
    throw new GovernanceBlockedError("SEARCH_NOT_EVIDENCE", "Search results are discovery only; verify the original source");
  }

  return Object.freeze({ ok: true, action, capability, authorization, policy: { ...policy } });
}

export function planOperation(operation, policy = DEFAULT_POLICY) {
  const gate = validateOperation(operation, policy);
  return Object.freeze({
    status: "approved-for-execution",
    gates: ["security-capability", "provenance", "validation", ...(operation.action === "publish" || operation.action === "export" ? ["rights"] : [])],
    ...gate
  });
}
