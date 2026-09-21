export const DOMAINS = Object.freeze(['TAFSIR', 'SIRAH']);

export function createTafsirSirahEngine() {
  return { works: new Map(), passages: new Map(), links: new Map(), disagreements: new Map() };
}

export function registerWork(engine, { workId, domain, title, author, sourceId, sourceHash, rightsStatus = 'UNKNOWN' }) {
  if (!DOMAINS.includes(domain) || !workId || !title || !sourceId || !sourceHash) throw new Error('work requires domain, identity, source and hash');
  const work = { workId, domain, title, author: author || null, sourceId, sourceHash, rightsStatus };
  engine.works.set(workId, work);
  return work;
}

export function registerPassage(engine, { passageId, workId, location, text, page = null }) {
  if (!engine.works.has(workId) || !passageId || !text || !location) throw new Error('passage must link to a registered work');
  const passage = { passageId, workId, location, page, text };
  engine.passages.set(passageId, passage);
  return passage;
}

export function linkEvidence(engine, { linkId, passageId, claimId, relation = 'SUPPORTS' }) {
  if (!engine.passages.has(passageId) || !claimId) throw new Error('evidence link requires passage and claim');
  const link = { linkId, passageId, claimId, relation };
  engine.links.set(linkId, link);
  return link;
}

export function recordDisagreement(engine, { disagreementId, claimId, passageIds, summary }) {
  if (!claimId || !Array.isArray(passageIds) || passageIds.length < 2) throw new Error('disagreement requires multiple evidence passages');
  const item = { disagreementId, claimId, passageIds: [...passageIds], summary: summary || '', state: 'DISPUTED' };
  engine.disagreements.set(disagreementId, item);
  return item;
}

export function publishableWork(engine, workId) {
  const work = engine.works.get(workId);
  return Boolean(work && work.rightsStatus === 'ALLOWED');
}
