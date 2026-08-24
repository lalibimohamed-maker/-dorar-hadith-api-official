const ALLOWED_STATUSES = new Set([
  "redistributable",
  "licensed",
  "public-domain",
  "rights-unclear",
  "restricted",
  "unknown"
]);

export class RightsRegistryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RightsRegistryError";
    this.code = code;
  }
}

export function createRightsRecord(input) {
  if (!input || typeof input !== "object") {
    throw new RightsRegistryError("INVALID_RECORD", "Rights record must be an object");
  }

  const { resourceId, status, basis, source, verifiedAt, verifier } = input;
  if (!resourceId) throw new RightsRegistryError("RESOURCE_ID_REQUIRED", "resourceId is required");
  if (!ALLOWED_STATUSES.has(status)) throw new RightsRegistryError("STATUS_INVALID", `Unsupported rights status: ${status}`);
  if (!basis) throw new RightsRegistryError("BASIS_REQUIRED", "A rights basis is required");
  if (!source) throw new RightsRegistryError("SOURCE_REQUIRED", "A rights source is required");
  if (!verifiedAt) throw new RightsRegistryError("VERIFIED_AT_REQUIRED", "verifiedAt is required");
  if (!verifier) throw new RightsRegistryError("VERIFIER_REQUIRED", "verifier is required");

  return Object.freeze({
    resourceId,
    status,
    basis,
    source,
    verifiedAt,
    verifier
  });
}

export function canRedistribute(record) {
  return Boolean(record && ["redistributable", "licensed", "public-domain"].includes(record.status));
}

export function assertRedistributable(record) {
  if (!canRedistribute(record)) {
    throw new RightsRegistryError(
      "REDISTRIBUTION_NOT_VERIFIED",
      "Redistribution is not verified for this resource"
    );
  }
  return true;
}
