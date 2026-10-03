import { GovernanceBlockedError, validateOperation } from "./orchestration-kernel.js";

export const PUBLISHABLE_RIGHTS = new Set(["redistributable", "licensed", "public-domain"]);
export const BOOK_INGESTION_ACTIONS = Object.freeze(["ingest", "publish", "export"]);

export class BookIngestionGovernanceError extends Error {
  constructor(code, message, cause = null) {
    super(message);
    this.name = "BookIngestionGovernanceError";
    this.code = code;
    this.cause = cause;
  }
}

export function validateBookIngestionRequest(request) {
  try {
    validateOperation({
      action: "ingest",
      resourceId: request?.resourceId,
      source: request?.source,
      provenance: request?.provenance,
      rights: request?.rights,
      validation: request?.validation,
      sourceKind: request?.sourceKind
    });
  } catch (error) {
    if (error instanceof GovernanceBlockedError) {
      throw new BookIngestionGovernanceError(error.code, error.message, error);
    }
    throw error;
  }

  return Object.freeze({
    resourceId: request.resourceId,
    source: request.source,
    provenance: request.provenance,
    rights: request.rights,
    validation: request.validation,
    governance: Object.freeze({
      action: "ingest",
      gates: Object.freeze(["resourceId", "source", "provenance", "rights", "validation"]),
      corpusMutation: false,
      ocrExecution: false
    })
  });
}

export function authorizeBookAction(request, action) {
  if (!BOOK_INGESTION_ACTIONS.includes(action)) {
    throw new BookIngestionGovernanceError("ACTION_INVALID", `Unsupported book action: ${action}`);
  }

  try {
    validateOperation({
      action,
      resourceId: request?.resourceId,
      source: request?.source,
      provenance: request?.provenance,
      rights: request?.rights,
      validation: request?.validation,
      sourceKind: request?.sourceKind
    });
  } catch (error) {
    if (error instanceof GovernanceBlockedError) {
      throw new BookIngestionGovernanceError(error.code, error.message, error);
    }
    throw error;
  }

  return Object.freeze({
    action,
    resourceId: request.resourceId,
    authorized: true,
    governance: Object.freeze({
      delegatedTo: "orchestration-kernel",
      corpusMutation: false,
      ocrExecution: false
    })
  });
}
