const CLAIM_KINDS = Object.freeze({
  primary_text: 'primary_text',
  transmitted_report: 'transmitted_report',
  scholarly_statement: 'scholarly_statement',
  explanation: 'explanation',
  algorithmic_signal: 'algorithmic_signal'
});

export function classifyClaim(claim = {}) {
  const kind = claim.kind;
  if (!Object.values(CLAIM_KINDS).includes(kind)) {
    throw new Error(`Unsupported claim kind: ${String(kind)}`);
  }

  const sourceId = claim.sourceId ?? null;
  const citation = claim.citation ?? null;
  const sourceBacked = kind !== CLAIM_KINDS.algorithmic_signal;

  return Object.freeze({
    kind,
    sourceId,
    citation,
    sourceBacked,
    canPresentAsOriginal: kind === CLAIM_KINDS.primary_text || kind === CLAIM_KINDS.transmitted_report,
    canPresentAsScholarlyStatement: kind === CLAIM_KINDS.scholarly_statement,
    mustLabelAsInterpretation: kind === CLAIM_KINDS.explanation,
    mustLabelAsAlgorithmic: kind === CLAIM_KINDS.algorithmic_signal
  });
}

export function validateClaimBoundary(claims = []) {
  return claims.map(classifyClaim);
}
