/**
 * @Rechercher alternative-source policy.
 *
 * A restriction on one edition/source is not a restriction on the underlying
 * work. The resolver therefore keeps the record discoverable and evaluates
 * explicitly discovered alternative editions before falling back to read-only.
 *
 * Candidates must be supplied by the governed discovery layer; this module
 * does not invent arbitrary download URLs.
 */

export const ALTERNATIVE_OUTCOMES = Object.freeze({
  USE_ALTERNATIVE: "use-alternative",
  READ_ONLY_ORIGINAL: "read-only-original",
  NEEDS_DISCOVERY: "needs-alternative-discovery"
});

const MIRRORABLE = new Set(["redistributable", "explicitly-licensed"]);

export function rankAlternativeEdition(candidate = {}) {
  const rights = String(candidate.rightsDecision || "unclear");
  const provenance = Boolean(candidate.sourceUrl || candidate.sourcePage);
  const verified = candidate.rightsVerified === true || MIRRORABLE.has(rights);
  if (!provenance || !verified) return -1;

  let score = 0;
  if (MIRRORABLE.has(rights)) score += 100;
  if (candidate.sameEdition === true) score += 30;
  if (candidate.authorMatched === true) score += 20;
  if (candidate.publisherMatched === true) score += 10;
  if (candidate.sha256) score += 5;
  return score;
}

export function resolveAlternativeSource(record = {}) {
  const candidates = Array.isArray(record.alternativeSources)
    ? record.alternativeSources
    : [];
  const ranked = candidates
    .map((candidate, index) => ({ candidate, index, score: rankAlternativeEdition(candidate) }))
    .filter(x => x.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  if (ranked.length) {
    return {
      outcome: ALTERNATIVE_OUTCOMES.USE_ALTERNATIVE,
      original: record,
      selected: ranked[0].candidate,
      candidatesConsidered: candidates.length
    };
  }

  if (candidates.length) {
    return {
      outcome: ALTERNATIVE_OUTCOMES.READ_ONLY_ORIGINAL,
      original: record,
      selected: null,
      candidatesConsidered: candidates.length,
      reason: "alternatives-found-but-no-rights-cleared-edition"
    };
  }

  return {
    outcome: ALTERNATIVE_OUTCOMES.NEEDS_DISCOVERY,
    original: record,
    selected: null,
    candidatesConsidered: 0,
    reason: "restricted-source-requires-governed-alternative-discovery"
  };
}
