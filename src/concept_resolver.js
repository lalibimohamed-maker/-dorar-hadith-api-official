import { conceptCard } from './corpus_api_contract.js';
import { routeConcept, filterConceptKnowledge } from './methodology-router.js';

export function resolveSelectedConcept(selectedText, contextId, language = 'ar', records = [], options = {}) {
  const text = String(selectedText || '').trim();
  const context = records.find(r => r.id === contextId);
  const candidates = records.filter(r => [r.title_ar, r.title, r.id].filter(Boolean).map(String).some(v => v === text || v.includes(text)));
  const record = context && candidates.length === 0 ? context : candidates[0] || context;
  const routing = routeConcept(record, options);
  return conceptCard({ term: text, contextId, language, record, routing });
}

export function buildKnowledgeSections(record, knowledge = {}, options = {}) {
  const sections = ['definition', 'contextual_meaning', 'quran_evidence', 'hadith_evidence', 'tafsir', 'aqidah', 'fiqh', 'seerah', 'scholarly_views', 'related_concepts', 'translations', 'sources'];
  const selected = sections.reduce((out, s) => {
    if (knowledge[s] !== undefined) out[s] = knowledge[s];
    return out;
  }, { id: record?.id || null });
  return filterConceptKnowledge(selected, record?.domain, Boolean(options.comparative));
}
