const { conceptCard } = require('./corpus_api_contract');

function resolveSelectedConcept(selectedText, contextId, language = 'ar', records = []) {
  const text = String(selectedText || '').trim();
  const context = records.find(r => r.id === contextId);
  const candidates = records.filter(r => {
    const values = [r.title_ar, r.title, r.id].filter(Boolean).map(String);
    return values.some(v => v === text || v.includes(text));
  });
  const record = context && candidates.length === 0 ? context : candidates[0] || context;
  return conceptCard({ term: text, contextId, language, record });
}

function buildKnowledgeSections(record, knowledge = {}) {
  const sections = ['definition','contextual_meaning','quran_evidence','hadith_evidence','tafsir','aqidah','fiqh','seerah','scholarly_views','related_concepts','translations','sources'];
  return sections.reduce((out, section) => {
    if (knowledge[section] !== undefined) out[section] = knowledge[section];
    return out;
  }, { id: record?.id || null });
}

module.exports = { resolveSelectedConcept, buildKnowledgeSections };
