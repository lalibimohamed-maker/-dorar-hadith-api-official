const REQUIRED = ['id', 'text', 'sourceId', 'citation', 'verificationState'];
const VERIFIED = new Set(['source_verified', 'edition_verified', 'scholar_reviewed']);

export const HADITH_RELATIONS = Object.freeze([
  'variant_of', 'narrated_by', 'has_narrator', 'evaluated_by', 'commented_on',
  'cites', 'derived_from', 'supports', 'related_to'
]);

export function validateHadith(record = {}) {
  const errors = [];
  for (const field of REQUIRED) {
    if (record[field] == null || record[field] === '') errors.push(`missing:${field}`);
  }
  if (record.generated === true) errors.push('generated-content-not-allowed');
  if (record.verificationState && !['pending', 'source_verified', 'edition_verified', 'scholar_reviewed'].includes(record.verificationState)) {
    errors.push(`invalid:verificationState:${record.verificationState}`);
  }
  if (record.source && typeof record.source !== 'object') errors.push('invalid:source');
  if (record.narration && typeof record.narration !== 'object') errors.push('invalid:narration');
  return { valid: errors.length === 0, errors };
}

export function isVerifiedHadith(record) {
  return validateHadith(record).valid && VERIFIED.has(record.verificationState);
}

export function normalizeHadith(record) {
  const result = validateHadith(record);
  if (!result.valid) throw new TypeError(`Invalid hadith: ${result.errors.join(',')}`);
  return structuredClone({
    ...record,
    text: String(record.text).normalize('NFC'),
    sourceId: String(record.sourceId),
    citation: String(record.citation),
    verificationState: String(record.verificationState),
    variants: Array.isArray(record.variants) ? record.variants : [],
    narrators: Array.isArray(record.narrators) ? record.narrators : [],
    scholarGrades: Array.isArray(record.scholarGrades) ? record.scholarGrades : [],
    commentaries: Array.isArray(record.commentaries) ? record.commentaries : [],
    provenance: record.provenance || { sourceId: record.sourceId, citation: record.citation }
  });
}
