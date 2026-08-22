import { searchResponse, conceptCard, bilingualResult } from './corpus_api_contract.js';
import { routeConcept } from './methodology-router.js';

export function searchCorpus(query, options = {}, records = []) {
  const language = options.language || 'ar';
  const bilingual = Boolean(options.bilingual);
  const normalized = String(query || '').trim().toLowerCase();
  const matches = records.filter(r => [r.title_ar, r.title, r.id].filter(Boolean).some(v => String(v).toLowerCase().includes(normalized)));
  return searchResponse({ query, language, bilingual, results: matches.map(r => ({ ...r, methodology: routeConcept(r, options) })) });
}

export function resolveConcept(term, contextId, language = 'ar', records = [], options = {}) {
  const record = records.find(r => r.id === contextId) || records.find(r => r.title_ar === term || r.title === term) || records.find(r => String(r.title_ar || '').includes(term));
  return conceptCard({ term, contextId, language, record, routing: routeConcept(record, options) });
}

export function makeBilingual(originalArabic, translation, targetLanguage) { return bilingualResult(originalArabic, translation, targetLanguage); }
