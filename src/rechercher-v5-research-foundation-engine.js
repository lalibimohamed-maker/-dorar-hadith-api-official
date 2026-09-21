export const RIGHTS_STATES = ['ALLOWED', 'RESTRICTED', 'UNKNOWN', 'EXPLICIT_PERMISSION_REQUIRED'];
export const IDENTITY_STATES = ['CANDIDATE', 'VERIFIED', 'DISPUTED'];
export const OCR_STATES = ['UNPROCESSED', 'OCR_CANDIDATE', 'OCR_VERIFIED', 'HUMAN_CORRECTED'];

export function createResearchFoundationEngine() {
  return { sources: new Map(), works: new Map(), editions: new Map(), manuscripts: new Map(), canvases: new Map(), comparisons: new Map(), versions: new Map() };
}

export function registerProvenance(engine, source) {
  if (!source?.sourceId || !source?.contentHash) throw new Error('sourceId and contentHash are required');
  const value = { ...source, provenanceVerified: Boolean(source.provenanceVerified) };
  engine.sources.set(source.sourceId, value);
  return value;
}

export function setRights(engine, sourceId, rightsState, permissionEvidence = null) {
  if (!RIGHTS_STATES.includes(rightsState)) throw new Error('invalid rights state');
  const source = engine.sources.get(sourceId);
  if (!source) throw new Error('source not registered');
  if (rightsState === 'EXPLICIT_PERMISSION_REQUIRED' && !permissionEvidence) throw new Error('explicit permission evidence required');
  source.rightsState = rightsState;
  source.permissionEvidence = permissionEvidence;
  return source;
}

export function registerWork(engine, work) {
  if (!work?.workId || !work?.title) throw new Error('workId and title are required');
  engine.works.set(work.workId, { ...work });
  return engine.works.get(work.workId);
}

export function registerEdition(engine, edition) {
  if (!edition?.editionId || !edition?.workId || !edition?.sourceId) throw new Error('editionId, workId and sourceId are required');
  if (!engine.works.has(edition.workId)) throw new Error('work not registered');
  if (!engine.sources.has(edition.sourceId)) throw new Error('source not registered');
  const value = { ...edition, identityState: edition.identityState || 'CANDIDATE' };
  engine.editions.set(edition.editionId, value);
  return value;
}

export function verifyEditionIdentity(engine, editionId, identityState, reviewerRole = null) {
  if (!IDENTITY_STATES.includes(identityState)) throw new Error('invalid identity state');
  if (identityState === 'VERIFIED' && !['TEACHER', 'SCHOLAR'].includes(reviewerRole)) throw new Error('human scholarly review required');
  const edition = engine.editions.get(editionId);
  if (!edition) throw new Error('edition not registered');
  edition.identityState = identityState;
  edition.identityReviewerRole = reviewerRole;
  return edition;
}

export function registerManuscript(engine, manuscript) {
  if (!manuscript?.manuscriptId || !manuscript?.editionId || !manuscript?.sourceId) throw new Error('manuscript identity is incomplete');
  if (!engine.editions.has(manuscript.editionId)) throw new Error('edition not registered');
  engine.manuscripts.set(manuscript.manuscriptId, { ...manuscript });
  return engine.manuscripts.get(manuscript.manuscriptId);
}

export function registerIIIFCanvas(engine, canvas) {
  if (!canvas?.canvasId || !canvas?.manuscriptId || !canvas?.pageHash) throw new Error('canvas identity is incomplete');
  if (!engine.manuscripts.has(canvas.manuscriptId)) throw new Error('manuscript not registered');
  engine.canvases.set(canvas.canvasId, { ...canvas });
  return engine.canvases.get(canvas.canvasId);
}

export function recordOCR(engine, canvasId, ocr) {
  const canvas = engine.canvases.get(canvasId);
  if (!canvas) throw new Error('canvas not registered');
  const value = { ...ocr, state: ocr?.state || 'OCR_CANDIDATE', sourcePageHash: canvas.pageHash };
  if (!OCR_STATES.includes(value.state)) throw new Error('invalid OCR state');
  canvas.ocr = value;
  return value;
}

export function reviewOCR(engine, canvasId, state, reviewerRole) {
  if (!['OCR_VERIFIED', 'HUMAN_CORRECTED'].includes(state)) throw new Error('invalid reviewed OCR state');
  if (!['TEACHER', 'SCHOLAR'].includes(reviewerRole)) throw new Error('teacher or scholar review required');
  return recordOCR(engine, canvasId, { ...engine.canvases.get(canvasId)?.ocr, state, reviewerRole });
}

export function compareEditions(engine, comparison) {
  if (!comparison?.comparisonId || !comparison?.leftEditionId || !comparison?.rightEditionId) throw new Error('comparison identity is incomplete');
  if (!engine.editions.has(comparison.leftEditionId) || !engine.editions.has(comparison.rightEditionId)) throw new Error('edition not registered');
  engine.comparisons.set(comparison.comparisonId, { ...comparison, differences: [] });
  return engine.comparisons.get(comparison.comparisonId);
}

export function addEditionDifference(engine, comparisonId, difference) {
  const comparison = engine.comparisons.get(comparisonId);
  if (!comparison) throw new Error('comparison not registered');
  comparison.differences.push({ ...difference });
  return comparison;
}

export function recordVersion(engine, version) {
  if (!version?.versionId || !version?.entityId || !version?.contentHash) throw new Error('version identity is incomplete');
  engine.versions.set(version.versionId, { ...version });
  return engine.versions.get(version.versionId);
}

export function publishableSource(engine, sourceId) {
  const source = engine.sources.get(sourceId);
  return Boolean(source && source.provenanceVerified && source.rightsState === 'ALLOWED');
}
