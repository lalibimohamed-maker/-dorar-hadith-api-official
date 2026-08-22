import { searchResponse, conceptCard, bilingualResult } from './corpus_api_contract.js';
import { routeConcept } from './methodology-router.js';
import { loadConceptIndex } from './corpus_repository.js';

function resolveIndexedConcept(term) {
  const normalized = String(term || '').trim();
  const groups = loadConceptIndex().groups || {};
  for (const [group, terms] of Object.entries(groups)) {
    const hit = (terms || []).find(item => item === normalized || item.includes(normalized) || normalized.includes(item));
    if (hit) {
      const domain = group === 'aqidah' ? 'aqidah' : group === 'quran' || group === 'language' ? 'quran-tafsir' : group === 'hadith' ? 'hadith-takhrij' : group === 'fiqh' || group === 'usul' ? 'fiqh' : group === 'seerah' ? 'seerah' : 'general';
      return { id: `concept-index:${group}:${hit}`, type: 'concept', domain, title_ar: hit, index_group: group, index_match: true };
    }
  }
  return null;
}

export function searchCorpus(query, options = {}, records = []) {
  const language = options.language || 'ar';
  const bilingual = Boolean(options.bilingual);
  const normalized = String(query || '').trim().toLowerCase();
  const matches = records.filter(r => [r.title_ar, r.title, r.id].filter(Boolean).some(v => String(v).toLowerCase().includes(normalized)));
  return searchResponse({ query, language, bilingual, results: matches.map(r => ({ ...r, methodology: routeConcept(r, options) })) });
}

export function resolveConcept(term, contextId, language = 'ar', records = [], options = {}) {
  const record = records.find(r => r.id === contextId) || records.find(r => r.title_ar === term || r.title === term) || records.find(r => String(r.title_ar || '').includes(term)) || resolveIndexedConcept(term);
  return conceptCard({ term, contextId: contextId || record?.id || null, language, record, routing: routeConcept(record, options) });
}

export function makeBilingual(originalArabic, translation, targetLanguage) { return bilingualResult(originalArabic, translation, targetLanguage); }
