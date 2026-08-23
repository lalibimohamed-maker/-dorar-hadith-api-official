import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(fs.readFileSync(path.join(root, '..', 'config', 'rijal-evidence-schema-2026.json'), 'utf8'));

const JARH_TERMS = ['ضعيف', 'متروك', 'منكر الحديث', 'ليس بثقة', 'واه', 'كذاب', 'متهم'];
const TAADIL_TERMS = ['ثقة', 'ثبت', 'صدوق', 'حجة', 'لا بأس به', 'مأمون'];

export function classifyRijalStatement(text = '') {
  const value = String(text).trim();
  const jarh = JARH_TERMS.some((term) => value.includes(term));
  const taadil = TAADIL_TERMS.some((term) => value.includes(term));
  if (jarh && taadil) return 'mixed';
  if (jarh) return 'jarh';
  if (taadil) return 'taadil';
  return 'uncategorized';
}

export function validateRijalStatement(statement = {}) {
  const errors = [];
  for (const field of schema.statementRequiredFields) {
    if (statement[field] === undefined || statement[field] === null || statement[field] === '') errors.push(`missing:${field}`);
  }
  if (statement.classification && !schema.classifications.includes(statement.classification)) errors.push(`unsupported-classification:${statement.classification}`);
  return { valid: errors.length === 0, errors };
}

export function validateNarratorRecord(record = {}) {
  const errors = [];
  for (const field of schema.requiredNarratorFields) {
    if (record[field] === undefined || record[field] === null) errors.push(`missing:${field}`);
  }
  if (record.identityStatus && !schema.identityStatuses.includes(record.identityStatus)) errors.push(`unsupported-identity-status:${record.identityStatus}`);
  if (!Array.isArray(record.statements)) errors.push('statements:not-array');
  else record.statements.forEach((statement, index) => {
    const result = validateRijalStatement(statement);
    result.errors.forEach((error) => errors.push(`statements[${index}]:${error}`));
  });
  return { valid: errors.length === 0, errors };
}

export function createRijalStatement({ statementId, critic, sourceId, reference, text, classification } = {}) {
  const statement = { statementId, critic, sourceId, reference, text, classification: classification || classifyRijalStatement(text) };
  const result = validateRijalStatement(statement);
  if (!result.valid) throw new TypeError(`Invalid rijal statement: ${result.errors.join(', ')}`);
  return statement;
}

export function summarizeNarratorEvidence(record = {}) {
  const statements = Array.isArray(record.statements) ? record.statements : [];
  return {
    narratorId: record.narratorId ?? null,
    primaryName: record.primaryName ?? null,
    identityStatus: record.identityStatus ?? 'unresolved',
    statementCount: statements.length,
    critics: [...new Set(statements.map((s) => s.critic).filter(Boolean))],
    classifications: [...new Set(statements.map((s) => s.classification).filter(Boolean))],
    independentStatements: statements.map((s) => ({ statementId: s.statementId, critic: s.critic, sourceId: s.sourceId, reference: s.reference, classification: s.classification }))
  };
}

export function compareNarratorStatements(record = {}) {
  const statements = Array.isArray(record.statements) ? record.statements : [];
  return statements.map((statement) => ({
    ...statement,
    isIndependentEvidence: true
  }));
}
