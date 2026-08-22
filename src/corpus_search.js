const { searchResponse, conceptCard, bilingualResult } = require('./corpus_api_contract');

function searchCorpus(query, options = {}, records = []) {
  const language = options.language || 'ar';
  const bilingual = Boolean(options.bilingual);
  const normalized = String(query || '').trim().toLowerCase();
  const matches = records.filter(record => {
    const fields = [record.title_ar, record.title, record.id].filter(Boolean);
    return fields.some(value => String(value).toLowerCase().includes(normalized));
  });
  return searchResponse({ query, language, bilingual, results: matches });
}

function resolveConcept(term, contextId, language = 'ar', records = []) {
  const record = records.find(item => item.id === contextId) ||
    records.find(item => item.title_ar === term || item.title === term);
  return conceptCard({ term, contextId, language, record });
}

function makeBilingual(originalArabic, translation, targetLanguage) {
  return bilingualResult(originalArabic, translation, targetLanguage);
}

module.exports = { searchCorpus, resolveConcept, makeBilingual };
