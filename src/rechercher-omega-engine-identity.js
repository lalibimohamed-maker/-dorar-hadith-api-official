/**
 * Canonical cross-layer identity for Rechercher Omega engines.
 *
 * The identity is deliberately narrower than any individual model/runtime
 * registry. Registries may contain discovery metadata; executable layers must
 * converge on this contract before activation.
 */
const LICENSE_STATES = new Set([
  "verified_source_license",
  "review_required",
  "blocked"
]);

const RIGHTS_STATES = new Set([
  "public_allowed",
  "private_only",
  "review_required",
  "blocked"
]);

const ACTIVATION_STATES = new Set([
  "registered",
  "installed",
  "verified",
  "active",
  "blocked"
]);

function requiredString(value, field) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`engine identity requires non-empty ${field}`);
  }
  return value;
}

export function normalizeEngineIdentity(input) {
  if (!input || typeof input !== "object") {
    throw new Error("engine identity must be an object");
  }

  const identity = {
    engine_id: requiredString(input.engine_id, "engine_id"),
    model_id: requiredString(input.model_id, "model_id"),
    revision: requiredString(input.revision, "revision"),
    runtime: requiredString(input.runtime, "runtime"),
    artifact: {
      kind: requiredString(input.artifact?.kind, "artifact.kind"),
      reference: requiredString(input.artifact?.reference, "artifact.reference"),
      sha256: input.artifact?.sha256 ?? null
    },
    license: {
      code: requiredString(input.license?.code, "license.code"),
      status: requiredString(input.license?.status, "license.status")
    },
    rights_state: requiredString(input.rights_state, "rights_state"),
    activation_state: requiredString(input.activation_state, "activation_state")
  };

  if (!LICENSE_STATES.has(identity.license.status)) {
    throw new Error(`invalid engine license status: ${identity.license.status}`);
  }
  if (!RIGHTS_STATES.has(identity.rights_state)) {
    throw new Error(`invalid engine rights state: ${identity.rights_state}`);
  }
  if (!ACTIVATION_STATES.has(identity.activation_state)) {
    throw new Error(`invalid engine activation state: ${identity.activation_state}`);
  }
  if (identity.artifact.sha256 !== null &&
      !/^[A-Fa-f0-9]{64}$/.test(identity.artifact.sha256)) {
    throw new Error("artifact.sha256 must be a 64-character SHA-256 digest");
  }

  return Object.freeze({
    ...identity,
    artifact: Object.freeze(identity.artifact),
    license: Object.freeze(identity.license)
  });
}

export function assertEngineActivation(identity) {
  const normalized = normalizeEngineIdentity(identity);

  if (normalized.activation_state === "active") {
    if (normalized.license.status !== "verified_source_license") {
      throw new Error("active engine requires verified source license");
    }
    if (["review_required", "blocked"].includes(normalized.rights_state)) {
      throw new Error("active engine cannot have review-required or blocked rights");
    }
    if (!normalized.artifact.sha256) {
      throw new Error("active engine requires immutable artifact SHA-256");
    }
  }

  return true;
}
