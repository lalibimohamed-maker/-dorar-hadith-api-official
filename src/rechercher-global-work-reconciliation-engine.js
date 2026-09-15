const DEFAULT_MATCH_THRESHOLDS = Object.freeze({
  title: 0.82,
  author: 0.80,
  edition: 0.78,
  manifestation: 0.75,
});

const IMMUTABLE_FIELDS = Object.freeze([
  'sourceIdentity',
  'contentHash',
  'canonicalQuranArabic',
  'originalPdf',
]);

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase();
}

function assertEvidence(record) {
  if (!record?.provenance) throw new Error('provenance is required');
  if (!record?.rightsState) throw new Error('rights state is required');
}

function scoreText(a, b) {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftTokens = new Set(left.split(/\s+/));
  const rightTokens = new Set(right.split(/\s+/));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return intersection / Math.max(leftTokens.size, rightTokens.size);
}

export function compareWorkCandidates(left, right) {
  return Object.freeze({
    title: scoreText(left?.title, right?.title),
    author: scoreText(left?.author, right?.author),
    edition: scoreText(left?.edition, right?.edition),
  });
}

export function reconcileWorkCandidate(candidate, existing = [], thresholds = DEFAULT_MATCH_THRESHOLDS) {
  assertEvidence(candidate);
  const ranked = existing
    .filter(Boolean)
    .map((record) => {
      const scores = compareWorkCandidates(candidate, record);
      const score = (scores.title * 0.55) + (scores.author * 0.30) + (scores.edition * 0.15);
      return { record, scores, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  // Titles can be translated, transliterated, or represented in another
  // script. Exact author + edition anchors are therefore an independent,
  // deterministic reconciliation path that does not depend on title overlap.
  const exactAuthorAndEdition = Boolean(
    best
      && normalize(candidate?.author)
      && normalize(candidate?.edition)
      && normalize(candidate?.author) === normalize(best.record?.author)
      && normalize(candidate?.edition) === normalize(best.record?.edition)
  );
  const anchoredByAuthorAndEdition = Boolean(
    best
      && best.scores.author >= thresholds.author
      && best.scores.edition >= thresholds.edition
  );
  const matched = Boolean(
    best
      && (
        (best.scores.title >= thresholds.title && best.scores.author >= thresholds.author)
        || anchoredByAuthorAndEdition
        || exactAuthorAndEdition
      )
  );
  return Object.freeze({
    matched,
    action: matched ? 'LINK_TO_EXISTING_WORK' : 'CREATE_NEW_WORK_CANDIDATE',
    confidence: best?.score ?? 0,
    bestMatch: best?.record ?? null,
    alternatives: ranked.slice(1, 10),
  });
}

export function chooseBestManifestation(manifestations = []) {
  return manifestations
    .filter((item) => item && item.publishable !== false)
    .map((item) => ({
      item,
      score: (Number(item.identityScore) || 0) * 0.20
        + (Number(item.completenessScore) || 0) * 0.20
        + (Number(item.imageQualityScore) || 0) * 0.15
        + (Number(item.pdfIntegrityScore) || 0) * 0.15
        + (Number(item.provenanceScore) || 0) * 0.15
        + (Number(item.rightsScore) || 0) * 0.15,
    }))
    .sort((a, b) => b.score - a.score)[0]?.item ?? null;
}

export function assertImmutableSource(previous, next) {
  for (const field of IMMUTABLE_FIELDS) {
    if (previous?.[field] !== undefined && previous?.[field] !== null && previous[field] !== next?.[field]) {
      throw new Error(`immutable source field cannot be mutated: ${field}`);
    }
  }
  return true;
}

export function createReconciliationTrace(input) {
  assertEvidence(input);
  return Object.freeze({
    traceId: input.traceId ?? `work-reconcile:${Date.now()}`,
    workId: input.workId ?? null,
    sourceId: input.sourceId ?? null,
    decision: input.decision ?? 'UNRESOLVED',
    confidence: Number(input.confidence) || 0,
    provenance: input.provenance,
    rightsState: input.rightsState,
  });
}

export const RECONCILIATION_CAPABILITIES = Object.freeze([
  'WORK_IDENTITY_RECONCILIATION',
  'EDITION_RECONCILIATION',
  'MANIFESTATION_RANKING',
  'PROVENANCE_GATED_MATCHING',
  'RIGHTS_GATED_SELECTION',
  'IMMUTABLE_SOURCE_PROTECTION',
  'RECONCILIATION_TRACE',
]);
