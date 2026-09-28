const ALLOWED_STATUSES = new Set([
  "redistributable",
  "licensed",
  "public-domain",
  "rights-unclear",
  "restricted",
  "unknown"
]);

const REDISTRIBUTION_STATUSES = new Set([
  "redistributable",
  "licensed",
  "public-domain"
]);

const REQUIRED_FIELDS = Object.freeze([
  "resourceId",
  "status",
  "basis",
  "source",
  "verifiedAt",
  "verifier"
]);

export class RightsRegistryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RightsRegistryError";
    this.code = code;
  }
}

function requiredString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function createRightsRecord(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new RightsRegistryError("INVALID_RECORD", "Rights record must be an object");
  }

  const { resourceId, status, basis, source, verifiedAt, verifier } = input;

  if (!requiredString(resourceId)) {
    throw new RightsRegistryError("RESOURCE_ID_REQUIRED", "resourceId is required");
  }
  if (!ALLOWED_STATUSES.has(status)) {
    throw new RightsRegistryError("STATUS_INVALID", `Unsupported rights status: ${status}`);
  }
  if (!requiredString(basis)) {
    throw new RightsRegistryError("BASIS_REQUIRED", "A rights basis is required");
  }
  if (!requiredString(source)) {
    throw new RightsRegistryError("SOURCE_REQUIRED", "A rights source is required");
  }
  if (!requiredString(verifiedAt)) {
    throw new RightsRegistryError("VERIFIED_AT_REQUIRED", "verifiedAt is required");
  }
  if (!requiredString(verifier)) {
    throw new RightsRegistryError("VERIFIER_REQUIRED", "verifier is required");
  }

  return Object.freeze({
    resourceId: resourceId.trim(),
    status,
    basis: basis.trim(),
    source: source.trim(),
    verifiedAt: verifiedAt.trim(),
    verifier: verifier.trim()
  });
}

export function isRightsRecord(record) {
  try {
    createRightsRecord(record);
    return true;
  } catch {
    return false;
  }
}

export function canRedistribute(record) {
  return isRightsRecord(record) && REDISTRIBUTION_STATUSES.has(record.status);
}

export function assertRedistributable(record) {
  if (!canRedistribute(record)) {
    throw new RightsRegistryError(
      "REDISTRIBUTION_NOT_VERIFIED",
      "A complete rights record with verified redistribution status is required"
    );
  }
  return true;
}

export function assertRightsRecord(record) {
  return createRightsRecord(record);
}

export const RIGHTS_RECORD_REQUIRED_FIELDS = REQUIRED_FIELDS;
export const RIGHTS_ALLOWED_REDISTRIBUTION_STATUSES = Object.freeze([...REDISTRIBUTION_STATUSES]);
export const RIGHTS_BLOCKED_STATUSES = Object.freeze([
  "rights-unclear",
  "restricted",
  "unknown"
]);
