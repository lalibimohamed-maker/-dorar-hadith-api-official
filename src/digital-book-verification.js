/**
 * Multi-candidate verification for OCR/extracted book text.
 *
 * This layer never invents or silently rewrites text. The source artifact
 * remains authoritative; verification only decides whether a derived value
 * has enough independent evidence to be accepted or sent to review.
 */

function normalizeText(text) {
  return String(text ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();
}

export function verifyExtractedText({ primary, candidates = [], trustedReference = null }) {
  const primaryValue = normalizeText(primary);
  if (!primaryValue) return { status: 'unverified', confidence: 0, text: primaryValue, reason: 'empty-primary' };

  if (trustedReference !== null && normalizeText(trustedReference) === primaryValue) {
    return { status: 'verified-reference', confidence: 1, text: primaryValue, reason: 'trusted-reference-match' };
  }

  const independentValues = candidates.map(normalizeText).filter(Boolean);
  const agreementCount = independentValues.filter(value => value === primaryValue).length;
  if (agreementCount >= 1) {
    return {
      status: 'verified-agreement',
      confidence: Math.min(0.99, 0.80 + Math.max(0, agreementCount - 1) * 0.05),
      text: primaryValue,
      reason: 'independent-candidate-agreement',
    };
  }

  return { status: 'needs-review', confidence: 0.25, text: primaryValue, reason: 'candidate-disagreement' };
}

/**
 * Verification never replaces text. It only authorizes an already matching
 * value to proceed; disagreements remain review items.
 */
export function applyVerifiedText(original, verification) {
  const originalValue = normalizeText(original);
  if (!verification || !['verified-reference', 'verified-agreement'].includes(verification.status)) {
    return { text: original, changed: false, verified: false };
  }
  if (originalValue !== verification.text) {
    return { text: original, changed: false, verified: false };
  }
  return { text: original, changed: false, verified: true };
}
