/**
 * Rights evidence model for reusable digital editions.
 * Evidence is recorded per edition/source; free availability alone is never permission.
 */

export const RIGHTS = Object.freeze({
  REDISTRIBUTABLE: 'redistributable',
  READ_COPY: 'read-copy',
  READ_ONLY: 'read-only',
  LINK_ONLY: 'link-only',
  RIGHTS_UNCLEAR: 'rights-unclear',
  RESTRICTED: 'restricted',
});

export function resolveRights(evidence = []) {
  const valid = evidence.filter((item) => item && item.source && item.kind);
  if (!valid.length) return { status: RIGHTS.RIGHTS_UNCLEAR, evidence: [] };

  // An explicit permission is stronger than a generic "free download" signal.
  if (valid.some((item) => item.kind === 'explicit-redistribution-permission')) {
    return { status: RIGHTS.REDISTRIBUTABLE, evidence: valid };
  }
  if (valid.some((item) => item.kind === 'public-domain')) {
    return { status: RIGHTS.REDISTRIBUTABLE, evidence: valid };
  }
  if (valid.some((item) => item.kind === 'waqf' && item.allowsRedistribution === true)) {
    return { status: RIGHTS.REDISTRIBUTABLE, evidence: valid };
  }
  if (valid.some((item) => item.kind === 'read-copy-permission')) {
    return { status: RIGHTS.READ_COPY, evidence: valid };
  }
  if (valid.some((item) => item.kind === 'read-only-permission')) {
    return { status: RIGHTS.READ_ONLY, evidence: valid };
  }
  if (valid.some((item) => item.kind === 'official-source')) {
    return { status: RIGHTS.LINK_ONLY, evidence: valid };
  }
  return { status: RIGHTS.RIGHTS_UNCLEAR, evidence: valid };
}
