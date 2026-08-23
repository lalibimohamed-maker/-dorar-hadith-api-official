import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(fs.readFileSync(path.join(root, '..', 'config', 'hadith-corpus-catalog-2026.json'), 'utf8'));

export function getHadithCorpusCatalog() { return structuredClone(catalog); }
export function listHadithBooks() { return [...catalog.books]; }
export function findHadithBook(id) { return catalog.books.find((book) => book.id === String(id || '')) || null; }
export function validateHadithRecord(record = {}) {
  const required = catalog.metadataPolicy.requiredForHadithRecord;
  const missing = required.filter((key) => record[key] === undefined || record[key] === null || record[key] === '');
  const source = findHadithBook(record.sourceId);
  const errors = [...missing.map((key) => `missing:${key}`)];
  if (!source) errors.push('unknown-source');
  if (record.verificationState && !['ingested','pending_review','source_verified','edition_verified','scholar_reviewed'].includes(record.verificationState)) errors.push('invalid-verification-state');
  return { valid: errors.length === 0, errors, sourceId: record.sourceId || null, trusted: ['source_verified','edition_verified','scholar_reviewed'].includes(record.verificationState) };
}
