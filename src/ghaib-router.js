import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POLICY_FILE = path.join(ROOT, 'config', 'ghaib-research-policy-2026.json');
const CONCEPT_FILE = path.join(ROOT, 'data', 'concepts', 'ghaib-concepts-2026.json');

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
export function loadGhaibPolicy() { return readJson(POLICY_FILE); }
export function loadGhaibConcepts() { return readJson(CONCEPT_FILE).concepts || []; }
export function resolveGhaibConcept(term) {
  const normalized = String(term || '').trim();
  return loadGhaibConcepts().find(c => c.nameAr === normalized || c.nameAr.includes(normalized) || normalized.includes(c.nameAr)) || null;
}
export function isGhaibDomain(domain) { return loadGhaibPolicy().domains.includes(domain); }
export function routeGhaibConcept(concept, { includeWeak = false } = {}) {
  const policy = loadGhaibPolicy();
  const layers = policy.evidenceLayers.filter(layer => includeWeak || !['weak-reports', 'fabricated-reports'].includes(layer.id));
  return { domain: concept?.domain || 'eschatology', mode: 'evidence_layered', evidence_layers: layers, source_rules: policy.sourceRules, answer_structure: policy.answerStructure, book_policy: policy.bookHandling, warning: 'وجود الخبر في كتاب لا يثبت صحته؛ الحكم يكون على الخبر نفسه ومصدره.', related_concepts: concept?.related || [] };
}
export function buildGhaibResearchPlan(query, concept) {
  return { query, concept: concept ? { id: concept.id, nameAr: concept.nameAr, domain: concept.domain } : null, retrieval_order: ['quran', 'authentic-sunnah', 'companions', 'early-salaf', 'scholar-books'], verification_before_display: true, never_promote_unverified_report: true, routing: routeGhaibConcept(concept || { domain: 'eschatology', related: [] }) };
}
