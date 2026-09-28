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

const REDISTRIBUTION_RIGHTS = new Set([
  "redistributable", "licensed", "public-domain"
]);

const PROVENANCE_FIELDS = Object.freeze([
  "source", "locator", "capturedAt"
]);

export class GovernanceBlockedError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GovernanceBlockedError";
    this.code = code;
  }
}

function completeProvenance(provenance) {
  return provenance &&
    PROVENANCE_FIELDS.every((field) =>
      typeof provenance[field] === "string" && provenance[field].trim().length > 0
    );
}

export function validateOperation(operation, policy = DEFAULT_POLICY) {
  if (!operation || typeof operation !== "object") {
    throw new GovernanceBlockedError("INVALID_OPERATION", "Operation must be an object");
  }

  const action = operation.action;
  if (!ALLOWED_ACTIONS.has(action)) {
    throw new GovernanceBlockedError("ACTION_NOT_ALLOWED", `Unsupported action: ${action}`);
  }

  if (policy.requireProvenance && !completeProvenance(operation.provenance)) {
    throw new GovernanceBlockedError(
      "PROVENANCE_REQUIRED",
      "Operation type and complete provenance (source, locator, capturedAt) are required"
    );
  }

  if ((action === "write" || action === "publish" || action === "export") &&
      policy.requireValidationForWrite &&
      operation.validation?.status !== "passed") {
    throw new GovernanceBlockedError(
      "VALIDATION_REQUIRED",
      "A passed validation result is required"
    );
  }

  if ((action === "publish" || action === "export") &&
      policy.requireRightsForPublish &&
      (!operation.rights ||
       !REDISTRIBUTION_RIGHTS.has(operation.rights.status))) {
    throw new GovernanceBlockedError(
      "RIGHTS_REQUIRED",
      "Redistribution rights are not verified"
    );
  }

  // Search is a discovery input. It may feed the discover route, but never
  // counts as proof of the underlying source for a protected operation.
  if (operation.sourceKind === "search-result" && action !== "discover" && !policy.allowSearchAsEvidence) {
    throw new GovernanceBlockedError(
      "SEARCH_NOT_EVIDENCE",
      "Search results are discovery only; verify the original source"
    );
  }

  return Object.freeze({
    ok: true,
    action,
    operationType: action,
    source: operation.provenance.source,
    policy: { ...policy }
  });
}

export function planOperation(operation, policy = DEFAULT_POLICY) {
  const gate = validateOperation(operation, policy);
  const gates = ["provenance"];
  if (["write", "publish", "export"].includes(operation.action)) gates.push("validation");
  if (["publish", "export"].includes(operation.action)) gates.push("rights");

  return Object.freeze({
    status: "approved-for-execution",
    gates,
    ...gate
  });
}
