const ALLOWED_ACTIONS = new Set([
  "read", "discover", "transform", "ingest", "write", "publish", "export"
]);

const REDISTRIBUTABLE_RIGHTS = new Set(["redistributable", "licensed", "public-domain"]);

const DEFAULT_POLICY = Object.freeze({
  requireProvenance: true,
  requireRightsForPublish: true,
  requireValidationForWrite: true,
  requireBookGatesForIngest: true,
  allowSearchAsEvidence: false,
  failClosed: true
});

export class GovernanceBlockedError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GovernanceBlockedError";
    this.code = code;
  }
}

function hasResourceIdentity(operation) {
  return typeof operation?.resourceId === "string" && Boolean(operation.resourceId.trim());
}

function hasKnownSource(operation) {
  const source = operation?.source;
  if (typeof source === "string") return Boolean(source.trim());
  if (!source || typeof source !== "object") return false;
  if (typeof source.id !== "string" || !source.id.trim()) return false;
  if (typeof source.url !== "string" || !source.url.trim()) return false;
  try {
    const url = new URL(source.url);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function hasProvenanceIdentity(operation) {
  const provenance = operation?.provenance;
  return Boolean(
    provenance &&
    typeof provenance === "object" &&
    ((typeof provenance.resourceId === "string" && provenance.resourceId.trim()) ||
      (typeof provenance.source === "string" && provenance.source.trim()) ||
      (typeof provenance.sourceId === "string" && provenance.sourceId.trim()))
  );
}

function hasPassedValidation(operation) {
  return operation?.validation?.status === "passed";
}

export function validateOperation(operation, policy = DEFAULT_POLICY) {
  if (!operation || typeof operation !== "object") {
    throw new GovernanceBlockedError("INVALID_OPERATION", "Operation must be an object");
  }

  const action = operation.action;
  if (!ALLOWED_ACTIONS.has(action)) {
    throw new GovernanceBlockedError("ACTION_NOT_ALLOWED", `Unsupported action: ${action}`);
  }

  if (policy.requireProvenance && !operation.provenance) {
    throw new GovernanceBlockedError("PROVENANCE_REQUIRED", "Provenance is required");
  }

  const bookAction = ["ingest", "publish", "export"].includes(action);
  if (bookAction && !hasResourceIdentity(operation)) {
    throw new GovernanceBlockedError("RESOURCE_ID_REQUIRED", "Book governance requires resourceId");
  }

  if (bookAction && !hasKnownSource(operation)) {
    throw new GovernanceBlockedError("SOURCE_REQUIRED", "Book governance requires a known source identity and URL");
  }

  if (bookAction && !hasProvenanceIdentity(operation)) {
    throw new GovernanceBlockedError("PROVENANCE_REQUIRED", "Book governance requires provenance identity");
  }

  if (action === "ingest" && policy.requireBookGatesForIngest) {
    if (!hasPassedValidation(operation)) {
      throw new GovernanceBlockedError("VALIDATION_REQUIRED", "Book ingestion requires passed validation");
    }
    if (!REDISTRIBUTABLE_RIGHTS.has(operation.rights?.status)) {
      throw new GovernanceBlockedError("RIGHTS_REQUIRED", "Book ingestion requires verified redistribution rights");
    }
  }

  if (action === "write" || action === "publish" || action === "export") {
    if (policy.requireValidationForWrite && operation.validation?.status !== "passed") {
      throw new GovernanceBlockedError("VALIDATION_REQUIRED", "A passed validation result is required");
    }
  }

  if ((action === "publish" || action === "export") && policy.requireRightsForPublish) {
    if (!REDISTRIBUTABLE_RIGHTS.has(operation.rights?.status)) {
      throw new GovernanceBlockedError("RIGHTS_REQUIRED", "Redistribution rights are not verified");
    }
  }

  if (operation.sourceKind === "search-result" && !policy.allowSearchAsEvidence) {
    throw new GovernanceBlockedError("SEARCH_NOT_EVIDENCE", "Search results are discovery only; verify the original source");
  }

  return Object.freeze({ ok: true, action, policy: { ...policy } });
}

export function planOperation(operation, policy = DEFAULT_POLICY) {
  const gate = validateOperation(operation, policy);
  const bookAction = ["ingest", "publish", "export"].includes(operation.action);
  return Object.freeze({
    status: "approved-for-execution",
    gates: bookAction
      ? ["resourceId", "source", "provenance", "rights", "validation"]
      : ["provenance", "validation", ...(operation.action === "publish" || operation.action === "export" ? ["rights"] : [])],
    ...gate
  });
}
