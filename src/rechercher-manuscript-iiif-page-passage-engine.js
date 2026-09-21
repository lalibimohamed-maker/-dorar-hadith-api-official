const PAGE_STATE = Object.freeze({
  DISCOVERED: 'DISCOVERED',
  IDENTIFIED: 'IDENTIFIED',
  ALIGNED: 'ALIGNED',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
});

function requireString(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`);
}

export function createPageRecord(input = {}) {
  requireString(input.manifestId, 'manifestId');
  requireString(input.canvasId, 'canvasId');
  requireString(input.pageId, 'pageId');
  return {
    manifestId: input.manifestId,
    canvasId: input.canvasId,
    pageId: input.pageId,
    imageService: input.imageService ?? null,
    sourceHash: input.sourceHash ?? null,
    state: PAGE_STATE.DISCOVERED,
    immutable: true,
  };
}

export function alignPassageToPage(page, passage = {}) {
  if (!page || page.immutable !== true) throw new Error('immutable page record is required');
  requireString(passage.passageId, 'passageId');
  requireString(passage.text, 'text');
  if (!passage.provenance) throw new Error('passage provenance is required');
  return {
    ...page,
    state: PAGE_STATE.ALIGNED,
    passage: {
      passageId: passage.passageId,
      text: passage.text,
      provenance: passage.provenance,
      reviewState: passage.reviewState ?? 'UNREVIEWED',
    },
  };
}

export function markPageForReview(record, reason) {
  requireString(reason, 'reason');
  return { ...record, state: PAGE_STATE.REVIEW_REQUIRED, reviewReason: reason };
}

export function pagePassageCapabilities() {
  return [
    'CANVAS_PAGE_IDENTITY',
    'IMAGE_TEXT_ALIGNMENT',
    'PASSAGE_PROVENANCE',
    'OCR_HTR_REVIEW_GATE',
    'IMMUTABLE_PAGE_SOURCE',
  ];
}
