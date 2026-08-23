import { validateHadith } from './hadith-corpus-contract.js';
import { getSource } from './source-registry.js';

export function normalizeHadithRecord(input = {}) {
  return {
    ...input,
    id: String(input.id ?? '').trim(),
    text: typeof input.text === 'string' ? input.text.trim() : input.text,
    sourceId: String(input.sourceId ?? '').trim(),
    citation: String(input.citation ?? '').trim(),
    verificationState: input.verificationState ?? 'pending',
    provenance: input.provenance ? structuredClone(input.provenance) : input.provenance,
    variants: Array.isArray(input.variants) ? structuredClone(input.variants) : [],
    narrators: Array.isArray(input.narrators) ? structuredClone(input.narrators) : [],
    scholarGrades: Array.isArray(input.scholarGrades) ? structuredClone(input.scholarGrades) : [],
    commentaries: Array.isArray(input.commentaries) ? structuredClone(input.commentaries) : []
  };
}

export function validateIngestionRecord(record, registry) {
  const hadith = validateHadith(record);
  const source = record?.sourceId ? getSource(registry, record.sourceId) : null;
  const errors = [...hadith.errors];
  if (!source) errors.push('source:not-registered');
  return { valid: errors.length === 0, errors, source };
}

export function ingestHadithRecord(registry, input, { allowPending = true } = {}) {
  const record = normalizeHadithRecord(input);
  const result = validateIngestionRecord(record, registry);
  if (!result.valid) throw new TypeError(`Rejected hadith: ${result.errors.join(',')}`);
  if (!allowPending && record.verificationState === 'pending') {
    throw new TypeError('Rejected hadith:verification-pending');
  }
  if (record.generated === true) throw new TypeError('Rejected hadith:generated-content');
  return { ...record, ingestionState: record.verificationState === 'pending' ? 'review' : 'accepted' };
}

export function ingestBatch(registry, records, options = {}) {
  const accepted = [];
  const rejected = [];
  for (const input of records ?? []) {
    try {
      accepted.push(ingestHadithRecord(registry, input, options));
    } catch (error) {
      rejected.push({ input, reason: error.message });
    }
  }
  return { accepted, rejected, total: (records ?? []).length };
}
