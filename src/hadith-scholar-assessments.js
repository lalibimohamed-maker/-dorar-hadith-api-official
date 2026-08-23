export function validateScholarAssessment(item = {}) {
  const required = ['hadithId', 'scholarId', 'sourceId', 'reference', 'text'];
  const errors = required.filter((field) => !item[field]).map((field) => `missing:${field}`);
  return { valid: errors.length === 0, errors };
}

export function buildScholarAssessment(item = {}) {
  const result = validateScholarAssessment(item);
  if (!result.valid) throw new TypeError(`Invalid scholar assessment: ${result.errors.join(', ')}`);
  return {
    hadithId: item.hadithId,
    scholarId: item.scholarId,
    scholarName: item.scholarName || null,
    sourceId: item.sourceId,
    reference: item.reference,
    text: item.text,
    classification: item.classification || 'unclassified',
    verificationState: item.verificationState || 'pending_review'
  };
}

export function groupScholarAssessments(hadithId, assessments = []) {
  const relevant = assessments.filter((item) => item.hadithId === hadithId).map(buildScholarAssessment);
  const byClassification = Object.groupBy(relevant, (item) => item.classification);
  const disagreements = Object.keys(byClassification).length > 1;
  return { hadithId, assessments: relevant, byClassification, disagreements, synthesizedVerdict: null };
}
