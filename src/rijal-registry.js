import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(fs.readFileSync(path.join(root, '..', 'data', 'rijal', 'rijal-source-registry-2026.json'), 'utf8'));

const JARH_TAADIL_TERMS = Object.freeze({
  jarh: ['ضعيف', 'متروك', 'منكر الحديث', 'ليس بثقة', 'واهٍ', 'كذاب', 'متهم'],
  taadil: ['ثقة', 'ثبت', 'صدوق', 'لا بأس به', 'صالح الحديث']
});

export function listRijalSources() { return structuredClone(registry.books); }
export function getRijalSource(sourceId) { return registry.books.find((book) => book.id === sourceId) || null; }

export function classifyJudgment(text = '') {
  const value = String(text).trim();
  const jarh = JARH_TAADIL_TERMS.jarh.filter((term) => value.includes(term));
  const taadil = JARH_TAADIL_TERMS.taadil.filter((term) => value.includes(term));
  if (jarh.length && taadil.length) return { category: 'mixed', matchedTerms: [...new Set([...jarh, ...taadil])] };
  if (jarh.length) return { category: 'jarh', matchedTerms: jarh };
  if (taadil.length) return { category: 'taadil', matchedTerms: taadil };
  return { category: 'unclassified', matchedTerms: [] };
}

export function validateNarratorJudgment(record = {}) {
  const errors = [];
  for (const field of ['recordId', 'narratorId', 'criticId', 'sourceId', 'citation', 'judgmentText']) {
    if (!record[field]) errors.push(`missing:${field}`);
  }
  if (record.sourceId && !getRijalSource(record.sourceId)) errors.push(`unknown-source:${record.sourceId}`);
  const classification = classifyJudgment(record.judgmentText || '');
  return { valid: errors.length === 0, errors, classification, attributed: Boolean(record.criticId && record.sourceId && record.citation) };
}

export function compareJudgments(judgments = []) {
  return judgments.map((judgment) => ({
    ...judgment,
    classification: classifyJudgment(judgment.judgmentText || '')
  }));
}

export function summarizeNarratorEvidence(judgments = []) {
  const evidence = compareJudgments(judgments);
  return {
    total: evidence.length,
    jarh: evidence.filter((x) => x.classification.category === 'jarh').length,
    taadil: evidence.filter((x) => x.classification.category === 'taadil').length,
    mixed: evidence.filter((x) => x.classification.category === 'mixed').length,
    unclassified: evidence.filter((x) => x.classification.category === 'unclassified').length,
    sources: [...new Set(evidence.map((x) => x.sourceId).filter(Boolean))],
    critics: [...new Set(evidence.map((x) => x.criticId).filter(Boolean))]
  };
}
