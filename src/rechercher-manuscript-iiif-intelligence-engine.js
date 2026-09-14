const IIIF_PROTOCOL = 'PRESENTATION_3_0';
const REVIEW_STATES = ['UNREVIEWED', 'HUMAN_REVIEWED', 'SCHOLAR_REVIEWED'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createManifestRecord(input = {}) {
  assert(input.manifestId, 'manifestId is required');
  assert(input.sourceId, 'sourceId is required');
  assert(input.workId, 'workId is required');
  assert(input.provenance, 'provenance is required');
  return {
    protocol: IIIF_PROTOCOL,
    manifestId: input.manifestId,
    sourceId: input.sourceId,
    workId: input.workId,
    editionId: input.editionId ?? null,
    label: input.label ?? null,
    canvases: Array.isArray(input.canvases) ? input.canvases : [],
    provenance: input.provenance,
    rights: input.rights ?? 'UNKNOWN',
    reviewState: input.reviewState ?? 'UNREVIEWED'
  };
}

function addCanvas(manifest, canvas) {
  assert(manifest?.protocol === IIIF_PROTOCOL, 'IIIF Presentation 3.0 manifest is required');
  assert(canvas?.canvasId, 'canvasId is required');
  assert(canvas?.sequence >= 1, 'canvas sequence must be positive');
  return {
    ...manifest,
    canvases: [...manifest.canvases, {
      canvasId: canvas.canvasId,
      sequence: canvas.sequence,
      label: canvas.label ?? null,
      imageService: canvas.imageService ?? null,
      annotations: Array.isArray(canvas.annotations) ? canvas.annotations : []
    }]
  };
}

function alignPageText(manifest, canvasId, alignment) {
  const canvas = manifest.canvases.find((item) => item.canvasId === canvasId);
  assert(canvas, 'canvas not found');
  assert(alignment?.text, 'aligned text is required');
  assert(alignment?.provenance, 'alignment provenance is required');
  return {
    ...manifest,
    canvases: manifest.canvases.map((item) => item.canvasId === canvasId
      ? { ...item, annotations: [...item.annotations, {
        type: 'TEXT_ALIGNMENT',
        text: alignment.text,
        language: alignment.language ?? null,
        source: alignment.source ?? null,
        provenance: alignment.provenance,
        confidence: alignment.confidence ?? null,
        reviewState: alignment.reviewState ?? 'UNREVIEWED'
      }] }
      : item)
  };
}

function rankManifestation(manifest, signals = {}) {
  assert(manifest?.provenance, 'manifest provenance is required');
  const score =
    (signals.identity ? 30 : 0) +
    (signals.completeness ? 20 : 0) +
    (signals.imageQuality ? 15 : 0) +
    (signals.textAlignment ? 15 : 0) +
    (signals.rightsAllowed ? 10 : 0) +
    (signals.authoritativeRepository ? 10 : 0);
  return { manifestId: manifest.manifestId, score, protocol: manifest.protocol };
}

function isPublishableManifest(manifest) {
  return manifest?.rights === 'ALLOWED' &&
    manifest?.provenance &&
    REVIEW_STATES.includes(manifest.reviewState) &&
    manifest.reviewState !== 'UNREVIEWED';
}

function createManuscriptIIIFEngine() {
  return {
    createManifestRecord,
    addCanvas,
    alignPageText,
    rankManifestation,
    isPublishableManifest
  };
}

module.exports = {
  IIIF_PROTOCOL,
  REVIEW_STATES,
  createManifestRecord,
  addCanvas,
  alignPageText,
  rankManifestation,
  isPublishableManifest,
  createManuscriptIIIFEngine
};
