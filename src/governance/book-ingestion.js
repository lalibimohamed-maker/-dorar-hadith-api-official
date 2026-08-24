const PUBLISHABLE_RIGHTS = new Set(["redistributable", "licensed", "public-domain"]);

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

export function authorizeBookAction(request, action) {
  const validated = validateBookIngestionRequest(request);
  if (!["ingest", "publish", "export"].includes(action)) {
    throw new BookIngestionGovernanceError("ACTION_INVALID", `Unsupported book action: ${action}`);
  }
  return Object.freeze({ action, resourceId: validated.resourceId, authorized: true });
}
