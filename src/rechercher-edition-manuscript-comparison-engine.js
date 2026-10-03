const COMPARISON_STATE = Object.freeze({
  CANDIDATE: 'CANDIDATE',
  MATCHED: 'MATCHED',
  DIVERGENT: 'DIVERGENT',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
});

function requireString(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`);
}

export function compareManifestations(left = {}, right = {}) {
  requireString(left.manifestationId, 'left.manifestationId');
  requireString(right.manifestationId, 'right.manifestationId');
  if (left.manifestationId === right.manifestationId) throw new Error('distinct manifestations are required');
  const identityMatch = left.workId && right.workId && left.workId === right.workId;
  const editionMatch = left.editionId && right.editionId && left.editionId === right.editionId;
  const contentMatch = left.contentHash && right.contentHash && left.contentHash === right.contentHash;
  const state = contentMatch || (identityMatch && editionMatch) ? COMPARISON_STATE.MATCHED : COMPARISON_STATE.CANDIDATE;
  return { left: left.manifestationId, right: right.manifestationId, identityMatch, editionMatch, contentMatch, state };
}

export function comparePageRecords(left = {}, right = {}) {
  requireString(left.pageId, 'left.pageId');
  requireString(right.pageId, 'right.pageId');
  const textMatch = left.textHash && right.textHash && left.textHash === right.textHash;
  const imageMatch = left.imageHash && right.imageHash && left.imageHash === right.imageHash;
  return {
    leftPageId: left.pageId,
    rightPageId: right.pageId,
    textMatch,
    imageMatch,
    state: textMatch || imageMatch ? COMPARISON_STATE.MATCHED : COMPARISON_STATE.DIVERGENT,
    reviewRequired: !textMatch || !imageMatch,
  };
}

export function createComparisonRecord(input = {}) {
  requireString(input.comparisonId, 'comparisonId');
  requireString(input.leftManifestationId, 'leftManifestationId');
  requireString(input.rightManifestationId, 'rightManifestationId');
  if (!input.provenance) throw new Error('comparison provenance is required');
  return {
    comparisonId: input.comparisonId,
    leftManifestationId: input.leftManifestationId,
    rightManifestationId: input.rightManifestationId,
    provenance: input.provenance,
    state: input.state ?? COMPARISON_STATE.CANDIDATE,
    reviewState: input.reviewState ?? 'UNREVIEWED',
    immutableInputs: true,
  };
}

export function editionManuscriptComparisonCapabilities() {
  return [
    'WORK_EDITION_RECONCILIATION',
    'MANIFESTATION_COMPARISON',
    'PAGE_LEVEL_COMPARISON',
    'TEXT_IMAGE_VARIANT_DETECTION',
    'PROVENANCE_REQUIRED_COMPARISON',
    'SCHOLAR_REVIEW_GATE',
  ];
}
