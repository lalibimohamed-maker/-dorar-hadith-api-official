const CITATION_RE = /\[E(\d+)\]/g;

export function extractCitationIds(answer = '') {
  const ids = [];
  for (const match of String(answer).matchAll(CITATION_RE)) ids.push(`E${match[1]}`);
  return [...new Set(ids)];
}

export function verifyAgentResponse({
  answer,
  evidence = [],
  intent = 'general',
  evidenceRequired = true,
  claimedCitations = [],
  claims = []
} = {}) {
  const text = String(answer || '').trim();
  const knownIds = new Set(evidence.map(item => item.citationId));
  const extracted = extractCitationIds(text);
  const citations = [...new Set([...extracted, ...claimedCitations])];
  const unknownCitations = citations.filter(id => !knownIds.has(id));
  const normalizedClaims = Array.isArray(claims)
    ? claims.map(claim => ({
      text: String(claim?.text || '').trim(),
      citations: Array.isArray(claim?.citations) ? claim.citations.map(String) : []
    })).filter(claim => claim.text)
    : [];
  const unsupportedClaims = normalizedClaims.filter(claim => claim.citations.length === 0);
  const unknownClaimCitations = normalizedClaims.flatMap(claim => claim.citations.filter(id => !knownIds.has(id)));
  const refusal = /insufficient evidence|no verified evidence|لا توجد أدلة كافية|لا تتوفر أدلة كافية/i.test(text);
  const issues = [];

  if (!text) issues.push('empty-answer');
  if (unknownCitations.length || unknownClaimCitations.length) issues.push('unknown-citation');
  if (evidenceRequired && !refusal && citations.length === 0) issues.push('missing-citation');
  if (evidenceRequired && !evidence.length && !refusal) issues.push('answer-without-evidence');
  if (normalizedClaims.length && unsupportedClaims.length) issues.push('uncited-claim');

  return Object.freeze({
    status: issues.length ? 'rejected' : 'verified-structure',
    answer: text,
    citations,
    claims: normalizedClaims,
    unsupportedClaims,
    unknownCitations: [...new Set([...unknownCitations, ...unknownClaimCitations])],
    refusal,
    issues,
    intent,
    limitations: [
      'This verifier checks citation identity and claim-to-citation structure; it does not independently prove a claim true.',
      'Hadith grading and fiqh attribution remain properties of the cited scholarly evidence.'
    ],
    policy: {
      sourceAttributionRequired: true,
      inventedCitationRejected: true,
      unsupportedAnswerRejected: evidenceRequired,
      uncitedClaimRejected: normalizedClaims.length > 0,
      generatedTextIsCanonical: false,
      canonicalCorpusMutation: false
    }
  });
}
