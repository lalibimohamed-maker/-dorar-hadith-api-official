const CLASSIFICATIONS = new Set(['sahih','hasan','daif','mawdu','mursal','muallaq','mutawatir','gharib','unclassified']);

export function validateHadithAssessment(item = {}) {
  const required = ['hadithId', 'scholarId', 'sourceId', 'reference', 'text'];
  const errors = required.filter((key) => !item[key]).map((key) => `missing:${key}`);
  if (item.classification && !CLASSIFICATIONS.has(item.classification)) errors.push(`unsupported-classification:${item.classification}`);
  return { valid: errors.length === 0, errors };
}

export function normalizeHadithAssessment(item = {}) {
  const result = {
    hadithId: item.hadithId || null,
    scholarId: item.scholarId || null,
    scholarName: item.scholarName || null,
    sourceId: item.sourceId || null,
    reference: item.reference || null,
    text: item.text || null,
    classification: item.classification || 'unclassified',
    verificationState: item.verificationState || 'pending_review'
  };
  const validation = validateHadithAssessment(result);
  if (!validation.valid) throw new TypeError(`Invalid hadith assessment: ${validation.errors.join(', ')}`);
  return result;
}

export function groupHadithAssessments(hadithId, assessments = []) {
  const items = assessments.filter((item) => item.hadithId === hadithId).map(normalizeHadithAssessment);
  const byClassification = {};
  for (const item of items) byClassification[item.classification] = (byClassification[item.classification] || 0) + 1;
  return {
    hadithId,
    count: items.length,
    assessments: items,
    byClassification,
    disagreement: new Set(items.map((item) => item.classification)).size > 1,
    synthesizedVerdict: null
  };
}
