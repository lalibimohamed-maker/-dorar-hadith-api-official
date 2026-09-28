/** Rights evidence resolver. Free availability is never permission. Conflicts fail closed. */

export const RIGHTS = Object.freeze({
  REDISTRIBUTABLE: "redistributable",
  LICENSED: "licensed",
  PUBLIC_DOMAIN: "public-domain",
  READ_COPY: "read-copy",
  READ_ONLY: "read-only",
  LINK_ONLY: "link-only",
  RIGHTS_UNCLEAR: "rights-unclear",
  RESTRICTED: "restricted"
});

const REDISTRIBUTION_KINDS = new Set([
  "explicit-redistribution-permission",
  "public-domain",
  "licensed",
  "waqf"
]);
const BLOCKING_KINDS = new Set(["restricted","takedown","no-redistribution","copyright-reservation"]);
const READ_COPY_KINDS = new Set(["read-copy-permission"]);
const READ_ONLY_KINDS = new Set(["read-only-permission"]);
const OFFICIAL_KINDS = new Set(["official-source"]);

function validEvidence(item) {
  return item && typeof item === "object" && item.source && item.kind;
}

function hasBlockingEvidence(evidence) {
  return evidence.some(e => BLOCKING_KINDS.has(e.kind));
}

function redistributionEvidence(evidence) {
  return evidence.filter(e =>
    REDISTRIBUTION_KINDS.has(e.kind) &&
    (e.kind !== "waqf" || e.allowsRedistribution === true)
  );
}

function redistributionStatus(evidence) {
  if (evidence.some(e => e.kind === "public-domain")) return RIGHTS.PUBLIC_DOMAIN;
  if (evidence.some(e => e.kind === "licensed")) return RIGHTS.LICENSED;
  return RIGHTS.REDISTRIBUTABLE;
}

export function resolveRights(evidence = []) {
  const valid = evidence.filter(validEvidence);
  if (!valid.length) return { status: RIGHTS.RIGHTS_UNCLEAR, evidence: [], confidence: 0, conflict: false };

  const conflict = hasBlockingEvidence(valid) && redistributionEvidence(valid).length > 0;
  if (conflict) {
    return { status: RIGHTS.RIGHTS_UNCLEAR, evidence: valid, confidence: 0, conflict: true, reason: "conflicting-rights-evidence" };
  }

  if (redistributionEvidence(valid).length) {
    return { status: redistributionStatus(valid), evidence: valid, confidence: 1, conflict: false };
  }
  if (valid.some(e => READ_COPY_KINDS.has(e.kind))) {
    return { status: RIGHTS.READ_COPY, evidence: valid, confidence: 0.8, conflict: false };
  }
  if (valid.some(e => READ_ONLY_KINDS.has(e.kind))) {
    return { status: RIGHTS.READ_ONLY, evidence: valid, confidence: 0.8, conflict: false };
  }
  if (valid.some(e => OFFICIAL_KINDS.has(e.kind))) {
    return { status: RIGHTS.LINK_ONLY, evidence: valid, confidence: 0.6, conflict: false };
  }
  return { status: RIGHTS.RIGHTS_UNCLEAR, evidence: valid, confidence: 0, conflict: false };
}

export function canRead(result = {}, { sourceAllowsReading = false } = {}) {
  const blocked = [RIGHTS.RESTRICTED, RIGHTS.RIGHTS_UNCLEAR].includes(result.status);
  return !blocked && (
    [RIGHTS.REDISTRIBUTABLE, RIGHTS.LICENSED, RIGHTS.PUBLIC_DOMAIN, RIGHTS.READ_COPY].includes(result.status) ||
    (result.status === RIGHTS.READ_ONLY && sourceAllowsReading === true) ||
    (result.status === RIGHTS.LINK_ONLY && sourceAllowsReading === true)
  );
}

export function canCopyText(result = {}, { sourceAllowsCopy = true } = {}) {
  const blocked = [RIGHTS.RESTRICTED, RIGHTS.RIGHTS_UNCLEAR].includes(result.status);
  const sourceAllows = sourceAllowsCopy !== false;
  return !blocked && sourceAllows && (
    [RIGHTS.REDISTRIBUTABLE, RIGHTS.LICENSED, RIGHTS.PUBLIC_DOMAIN].includes(result.status) ||
    result.status === RIGHTS.READ_COPY
  );
}

export function canRedistribute(result = {}) {
  return [RIGHTS.REDISTRIBUTABLE, RIGHTS.LICENSED, RIGHTS.PUBLIC_DOMAIN].includes(result.status) &&
    result.conflict === false &&
    result.confidence === 1;
}

export function canMirror(result = {}) {
  return canRedistribute(result);
}
