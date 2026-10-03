const PUBLISHABLE_RIGHTS = new Set(["redistributable", "licensed", "public-domain"]);
const VERIFICATION_ALLOWED_RIGHTS = new Set([
  "redistributable",
  "licensed",
  "public-domain",
  "read-copy",
  "read-only",
  "link-only",
  "rights-unclear"
]);
const BLOCKED_RIGHTS = new Set(["restricted"]);

export class BookIngestionGovernanceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BookIngestionGovernanceError";
    this.code = code;
  }
}

function requireField(value, code, message) {
  if (value === undefined || value === null || value === "") {
    throw new BookIngestionGovernanceError(code, message);
  }
}

export function validateBookIngestionRequest(request) {
  if (!request || typeof request !== "object") {
    throw new BookIngestionGovernanceError("INVALID_REQUEST", "Ingestion request must be an object");
  }

  requireField(request.resourceId, "RESOURCE_ID_REQUIRED", "resourceId is required");
  requireField(request.source, "SOURCE_REQUIRED", "source is required");
  requireField(request.provenance, "PROVENANCE_REQUIRED", "provenance is required");
  requireField(request.rights, "RIGHTS_REQUIRED", "rights record is required");
  requireField(request.validation, "VALIDATION_REQUIRED", "validation result is required");

  if (request.validation !== "passed") {
    throw new BookIngestionGovernanceError("VALIDATION_REQUIRED", "Book ingestion requires passed validation");
  }

  if (!PUBLISHABLE_RIGHTS.has(request.rights.status)) {
    throw new BookIngestionGovernanceError(
      "RIGHTS_NOT_VERIFIED",
      "Book ingestion cannot publish or export without verified redistribution rights"
    );
  }

  return Object.freeze({
    resourceId: request.resourceId,
    source: request.source,
    provenance: request.provenance,
    rights: request.rights,
    validation: request.validation
  });
}

/**
 * Internal verification acquisition is deliberately separate from publishing.
 * Public discovery/access evidence must be supplied explicitly; it never grants
 * redistribution rights. The caller must also mark the use as internal and
 * prohibit public redistribution of the acquired copy.
 */
export function authorizeVerificationDownload(request) {
  if (!request || typeof request !== "object") {
    throw new BookIngestionGovernanceError("INVALID_REQUEST", "Verification request must be an object");
  }

  requireField(request.resourceId, "RESOURCE_ID_REQUIRED", "resourceId is required");
  requireField(request.source, "SOURCE_REQUIRED", "source is required");
  requireField(request.provenance, "PROVENANCE_REQUIRED", "provenance is required");
  requireField(request.rights, "RIGHTS_REQUIRED", "rights record is required");

  if (request.sourceAccess !== "public") {
    throw new BookIngestionGovernanceError(
      "SOURCE_ACCESS_NOT_PUBLIC",
      "Verification download requires explicitly recorded public source access"
    );
  }

  if (request.verificationUse !== "internal") {
    throw new BookIngestionGovernanceError(
      "VERIFICATION_USE_REQUIRED",
      "Verification download is limited to internal verification use"
    );
  }

  if (request.redistributionPermission !== "not-granted") {
    throw new BookIngestionGovernanceError(
      "REDISTRIBUTION_SEPARATION_REQUIRED",
      "Verification acquisition must not be used as a redistribution grant"
    );
  }

  if (!VERIFICATION_ALLOWED_RIGHTS.has(request.rights.status) || BLOCKED_RIGHTS.has(request.rights.status)) {
    throw new BookIngestionGovernanceError(
      "VERIFICATION_DOWNLOAD_BLOCKED",
      "Verification download is blocked by the recorded access/rights state"
    );
  }

  return Object.freeze({
    action: "verify-download",
    resourceId: request.resourceId,
    source: request.source,
    provenance: request.provenance,
    rights: request.rights,
    sourceAccess: request.sourceAccess,
    verificationUse: request.verificationUse,
    redistributionPermission: request.redistributionPermission,
    authorized: true
  });
}

export function authorizeBookAction(request, action) {
  const validated = validateBookIngestionRequest(request);
  if (!["ingest", "publish", "export"].includes(action)) {
    throw new BookIngestionGovernanceError("ACTION_INVALID", `Unsupported book action: ${action}`);
  }
  return Object.freeze({ action, resourceId: validated.resourceId, authorized: true });
}
