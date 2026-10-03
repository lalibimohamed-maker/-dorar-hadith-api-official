export const MADHAHIB = Object.freeze(['HANAFI','MALIKI','SHAFII','HANBALI']);

export function createFiqhEngine() {
  return { issues: new Map(), positions: new Map(), evidences: new Map() };
}

export function registerIssue(engine, { issueId, title, sourceIds = [] } = {}) {
  if (!issueId || !title) throw new TypeError('Fiqh issue requires issueId and title');
  if (engine.issues.has(issueId)) throw new Error(`Duplicate issue: ${issueId}`);
  engine.issues.set(issueId, { issueId, title, sourceIds: [...sourceIds] });
  return issueId;
}

export function addMadhhabPosition(engine, { positionId, issueId, madhhab, statement, sourceIds = [], evidenceIds = [] } = {}) {
  if (!positionId || !issueId || !statement || !MADHAHIB.includes(madhhab)) throw new TypeError('Position requires issue, madhhab and statement');
  if (!engine.issues.has(issueId)) throw new Error(`Unknown fiqh issue: ${issueId}`);
  const position = { positionId, issueId, madhhab, statement, sourceIds: [...sourceIds], evidenceIds: [...evidenceIds], status: 'SOURCE_LINKED' };
  engine.positions.set(positionId, position);
  return position;
}

export function compareMadhahib(engine, issueId) {
  if (!engine.issues.has(issueId)) throw new Error(`Unknown fiqh issue: ${issueId}`);
  return MADHAHIB.map((madhhab) => ({
    madhhab,
    positions: [...engine.positions.values()].filter((x) => x.issueId === issueId && x.madhhab === madhhab),
  }));
}
