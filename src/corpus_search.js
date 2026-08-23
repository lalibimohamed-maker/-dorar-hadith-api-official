import { searchResponse, conceptCard } from './corpus_api_contract.js';
import { routeConcept } from './methodology-router.js';
import { loadConceptIndex } from './corpus_repository.js';
import { resolveGhaybDomain } from './ghayb-router.js';

function resolveIndexedConcept(term) {
  const normalized = String(term || '').trim();
  const index = loadConceptIndex();
  const groups = index.groups || {};

  for (const [group, terms] of Object.entries(groups)) {
    const hit = (terms || []).find(item => item === normalized || item.includes(normalized) || normalized.includes(item));
    if (hit) {
      const domain = group === 'aqidah' ? 'aqidah' : group === 'quran' || group === 'language' ? 'quran-tafsir' : group === 'hadith' ? 'hadith-takhrij' : group === 'fiqh' || group === 'usul' ? 'fiqh' : group === 'seerah' ? 'seerah' : 'general';
      return { id: `concept-index:${group}:${hit}`, type: 'concept', domain, title_ar: hit, index_group: group, index_match: true };
    }
  }

  const aliases = index.aliases || {};
  for (const [canonical, aliasList] of Object.entries(aliases)) {
    const matched = [canonical, ...(aliasList || [])].some(alias => {
      const value = String(alias || '').trim();
      return value === normalized || value.includes(normalized) || normalized.includes(value);
    });
    if (!matched) continue;
    for (const [group, terms] of Object.entries(groups)) {
      if ((terms || []).includes(canonical)) {
        const domain = group === 'aqidah' ? 'aqidah' : group === 'quran' || group === 'language' ? 'quran-tafsir' : group === 'hadith' ? 'hadith-takhrij' : group === 'fiqh' || group === 'usul' ? 'fiqh' : group === 'seerah' ? 'seerah' : 'general';
        return { id:`concept-index:${group}:${canonical}`, type:'concept', domain, title_ar:canonical, index_group:group, index_match:true, alias_match:normalized!==canonical, matched_term:normalized };
      }
    }
  }
  return null;
}

export function searchCorpus(query, options = {}, records = []) {
  const language = options.language || 'ar';
  const normalized = String(query || '').trim().toLowerCase();
  const matches = records.filter(r => [r.title_ar, r.title, r.id].filter(Boolean).some(v => String(v).toLowerCase().includes(normalized)));
  return searchResponse({ query, language, results: matches.map(r => ({ ...r, methodology: routeConcept(r, options) })) });
}

export function resolveConcept(term, contextId, language = 'ar', records = [], options = {}) {
  const record = records.find(r => r.id === contextId) || records.find(r => r.title_ar === term || r.title === term) || records.find(r => String(r.title_ar || '').includes(term)) || resolveIndexedConcept(term) || resolveGhaybDomain(term);
  return conceptCard({ term, contextId: contextId || record?.id || null, language, record, routing: routeConcept(record, options) });
}

// Compatibility helper for the existing corpus search contract.
// Translation remains an explicit, on-demand presentation field; search itself stays Arabic-first.
export function makeBilingual(originalArabic, translation, language = 'en') {
  return {
    original_arabic: originalArabic,
    meaning_translation: { text: translation, language },
    open_original_on_demand: true
  };
}
