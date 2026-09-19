/**
 * Statement Extraction Engine
 *
 * Extracts attributed statements (قول/نص/تصريح) from retrieved evidence.
 * It does NOT decide truth. Every extracted statement keeps provenance,
 * attribution, location and extraction confidence, and must pass downstream
 * evidence validation before being used in synthesis.
 */

const ATTRIBUTION_PATTERNS = [
  /(?:قال|يقول|ذكر|صرّح|صرح|أفاد|أوضح|بيّن|بين|نصّ|نص)\s+(?:الإمام|الشيخ|الدكتور|الأستاذ|الباحث)?\s*([^:،؛.\n]{2,120})/u,
  /(?:يرى|ذهب|رجّح|اختار|استظهر)\s+([^:،؛.\n]{2,120})/u,
];

export function extractStatements(text, provenance = {}) {
  if (typeof text !== 'string' || !text.trim()) return [];

  const statements = [];
  const seen = new Set();

  for (const pattern of ATTRIBUTION_PATTERNS) {
    for (const match of text.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))) {
      const start = match.index ?? 0;
      const sentenceStart = Math.max(0, text.lastIndexOf('\n', start) + 1);
      const sentenceEnd = (() => {
        const candidates = ['.','؛','\n'];
        const positions = candidates.map(c => text.indexOf(c, start)).filter(p => p >= 0);
        return positions.length ? Math.min(...positions) + 1 : text.length;
      })();
      const statement = text.slice(sentenceStart, sentenceEnd).trim();
      if (!statement || seen.has(statement)) continue;
      seen.add(statement);
      statements.push({
        type: 'attributed_statement',
        statement,
        attributionHint: match[1]?.trim() ?? null,
        extractionConfidence: 'candidate',
        provenance: { ...provenance },
      });
    }
  }

  return statements;
}

export function validateStatementCandidate(candidate) {
  if (!candidate || candidate.type !== 'attributed_statement') return false;
  const p = candidate.provenance ?? {};
  return Boolean(
    candidate.statement &&
    p.sourceId &&
    (p.url || p.documentId || p.page || p.location)
  );
}

export function groupStatementCandidates(candidates = []) {
  const groups = new Map();
  for (const candidate of candidates) {
    if (!validateStatementCandidate(candidate)) continue;
    const key = candidate.statement
      .normalize('NFKC')
      .replace(/\s+/gu, ' ')
      .trim();
    const group = groups.get(key) ?? [];
    group.push(candidate);
    groups.set(key, group);
  }
  return [...groups.values()];
}
