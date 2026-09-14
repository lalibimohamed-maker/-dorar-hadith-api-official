export const SCIENCES = Object.freeze(['QURAN','TAJWEED','HADITH','RIJAL','TAFSIR','FIQH','USUL_AL_FIQH','SIRAH','AQIDAH','ARABIC']);
export const MADHAHIB = Object.freeze(['HANAFI','MALIKI','SHAFII','HANBALI']);

export function createIslamicSciencesEngine() {
  return { sources: new Map(), items: new Map(), positions: new Map(), disagreements: new Map() };
}

function required(value, name) { if (!value) throw new TypeError(`${name} is required`); }

export function registerSource(engine, { sourceId, science, sourceHash, rightsStatus = 'UNKNOWN', language = 'ar' } = {}) {
  required(sourceId, 'sourceId');
  required(sourceHash, 'sourceHash');
  if (!SCIENCES.includes(science)) throw new TypeError(`Unknown science: ${science}`);
  engine.sources.set(sourceId, { sourceId, science, sourceHash, rightsStatus, language });
  return sourceId;
}

export function registerItem(engine, { itemId, science, title, sourceIds = [], evidenceState = 'SOURCE_VERIFIED' } = {}) {
  required(itemId, 'itemId'); required(title, 'title');
  if (!SCIENCES.includes(science)) throw new TypeError(`Unknown science: ${science}`);
  if (!Array.isArray(sourceIds)) throw new TypeError('sourceIds must be an array');
  for (const id of sourceIds) if (!engine.sources.has(id)) throw new TypeError(`Unknown source: ${id}`);
  const item = { itemId, science, title, sourceIds: [...sourceIds], evidenceState };
  engine.items.set(itemId, item);
  return itemId;
}

export function registerFiqhPosition(engine, { positionId, issueId, madhhab, text, sourceIds = [] } = {}) {
  required(positionId, 'positionId'); required(issueId, 'issueId'); required(text, 'text');
  if (!MADHAHIB.includes(madhhab)) throw new TypeError(`Unknown madhhab: ${madhhab}`);
  for (const id of sourceIds) if (!engine.sources.has(id)) throw new TypeError(`Unknown source: ${id}`);
  engine.positions.set(positionId, { positionId, issueId, madhhab, text, sourceIds: [...sourceIds] });
  return positionId;
}

export function recordDisagreement(engine, { disagreementId, topicId, positionIds = [], note = '' } = {}) {
  required(disagreementId, 'disagreementId'); required(topicId, 'topicId');
  if (positionIds.length < 2) throw new TypeError('Disagreement requires at least two positions');
  for (const id of positionIds) if (!engine.positions.has(id)) throw new TypeError(`Unknown position: ${id}`);
  engine.disagreements.set(disagreementId, { disagreementId, topicId, positionIds: [...positionIds], note });
  return disagreementId;
}

export function getSourceStatus(engine, sourceId) {
  const source = engine.sources.get(sourceId);
  if (!source) throw new Error(`Unknown source: ${sourceId}`);
  return { sourceId, rightsStatus: source.rightsStatus, usableForPublication: source.rightsStatus === 'ALLOWED' };
}
