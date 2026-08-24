const ALLOWED_RIGHTS = new Set(["redistributable", "licensed", "public-domain"]);

export const SOURCE_CONNECTOR_STATES = Object.freeze({
  DISCOVERED: "discovered",
  FETCHABLE: "fetchable",
  BLOCKED: "blocked"
});

export function evaluateSourceConnectorRequest({ source, provenance, rights, validation }) {
  const failures = [];

  if (!source?.id || !source?.url) failures.push("source_required");
  if (!provenance?.resourceId || !provenance?.verifiedAt) failures.push("provenance_required");
  if (!rights?.status || !ALLOWED_RIGHTS.has(rights.status)) failures.push("rights_not_verified");
  if (validation?.status !== "valid") failures.push("validation_required");

  if (failures.length) {
    return { state: SOURCE_CONNECTOR_STATES.BLOCKED, allowed: false, failures };
  }

  return { state: SOURCE_CONNECTOR_STATES.FETCHABLE, allowed: true, failures: [] };
}

export function canFetchSource(request) {
  return evaluateSourceConnectorRequest(request).allowed;
}
