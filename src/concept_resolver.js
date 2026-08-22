import { conceptCard } from './corpus_api_contract.js';
import { routeConcept, filterConceptKnowledge } from './methodology-router.js';
import { loadConceptIndex } from './corpus_repository.js';

function resolveFromIndex(text) {
  const normalized = String(text || '').trim();
  const groups = loadConceptIndex().groups || {};
  for (const [group, terms] of Object.entries(groups)) {
    const hit = (terms || []).find(term => term === normalized || term.includes(normalized) || normalized.includes(term));
    if (hit) {
      const domain = group === 'aqidah' ? 'aqidah' : group === 'quran' || group === 'language' ? 'quran-tafsir' : group === 'hadith' ? 'hadith-takhrij' : group === 'fiqh' || group === 'usul' ? 'fiqh' : group === 'seerah' ? 'seerah' : 'general';
      return { id: `concept-index:${group}:${hit}`, type: 'concept', domain, title_ar: hit, index_group: group, index_match: true };
    }
  }
  return null;
}

export function resolveSelectedConcept(selectedText, contextId, language = 'ar', records = [], options = {}) {
  const text = String(selectedText || '').trim();
  const context = records.find(r => r.id === contextId);
  const candidates = records.filter(r => [r.title_ar, r.title, r.id].filter(Boolean).map(String).some(v => v === text || v.includes(text)));
  const record = context && candidates.length === 0 ? context : candidates[0] || context || resolveFromIndex(text);
  const routing = routeConcept(record, options);
  return conceptCard({ term: text, contextId: contextId || record?.id || null, language, record, routing });
}

export function buildKnowledgeSections(record, knowledge = {}, options = {}) {
  const sections = ['definition', 'contextual_meaning', 'quran_evidence', 'hadith_evidence', 'tafsir', 'aqidah', 'fiqh', 'seerah', 'scholarly_views', 'related_concepts', 'translations', 'sources'];
  const selected = sections.reduce((out, s) => {
    if (knowledge[s] !== undefined) out[s] = knowledge[s];
    return out;
  }, { id: record?.id || null });
  return filterConceptKnowledge(selected, record?.domain, Boolean(options.comparative));
}
