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
  claimedCitations = []
} = {}) {
  const text = String(answer || '').trim();
  const knownIds = new Set(evidence.map(item => item.citationId));
  const extracted = extractCitationIds(text);
  const citations = [...new Set([...extracted, ...claimedCitations])];
  const unknownCitations = citations.filter(id => !knownIds.has(id));
  const refusal = /insufficient evidence|no verified evidence|لا توجد أدلة كافية|لا تتوفر أدلة كافية/i.test(text);
  const issues = [];

  if (!text) issues.push('empty-answer');
  if (unknownCitations.length) issues.push('unknown-citation');
  if (evidenceRequired && !refusal && citations.length === 0) issues.push('missing-citation');
  if (evidenceRequired && !evidence.length && !refusal) issues.push('answer-without-evidence');

  return Object.freeze({
    status: issues.length ? 'rejected' : 'verified-structure',
    answer: text,
    citations,
    unknownCitations,
    refusal,
    issues,
    intent,
    limitations: [
      'This verifier checks evidence references and response structure; it does not independently judge the truth of a claim.',
      'Hadith grading and fiqh attribution remain properties of the cited scholarly evidence.'
    ],
    policy: {
      sourceAttributionRequired: true,
      inventedCitationRejected: true,
      unsupportedAnswerRejected: evidenceRequired,
      generatedTextIsCanonical: false,
      canonicalCorpusMutation: false
    }
  });
}
