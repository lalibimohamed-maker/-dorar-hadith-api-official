const TRUSTED = new Set(['source_verified', 'edition_verified', 'scholar_reviewed']);

export function classifyEvidence(evidence = {}) {
  if (evidence.generated === true) return 'generated';
  if (TRUSTED.has(String(evidence.verificationState || ''))) return 'trusted';
  if (evidence.sourceId && evidence.citation) return 'source_backed_unverified';
  return 'unsupported';
}

export function buildAnswerEvidence({ primary = [], secondary = [], generated = [] } = {}) {
  return {
    primary: primary.filter((x) => classifyEvidence(x) === 'trusted'),
    secondary: secondary.filter((x) => ['trusted', 'source_backed_unverified'].includes(classifyEvidence(x))),
    generated: generated.map((x) => ({ ...x, role: 'explanation_or_navigation_only' }))
  };
}

export function canPresentAsPrimaryEvidence(evidence) {
  return classifyEvidence(evidence) === 'trusted';
}

export function answerPolicy({ evidence = [] } = {}) {
  const classified = evidence.map((item) => ({ ...item, evidenceClass: classifyEvidence(item) }));
  return {
    primaryEvidence: classified.filter((x) => x.evidenceClass === 'trusted'),
    unverifiedEvidence: classified.filter((x) => x.evidenceClass === 'source_backed_unverified'),
    excludedFromEvidence: classified.filter((x) => ['generated', 'unsupported'].includes(x.evidenceClass)),
    rule: 'Generated content may explain or navigate, but cannot become primary religious evidence.'
  };
}
