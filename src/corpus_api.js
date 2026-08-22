const { loadCorpus, loadRouting } = require('./corpus_repository');
const { searchCorpus, resolveConcept } = require('./corpus_search');
const { buildKnowledgeSections } = require('./concept_resolver');

function search(query, options = {}) {
  const records = loadCorpus();
  return searchCorpus(query, options, records);
}

function concept(term, contextId, language = 'ar') {
  const records = loadCorpus();
  const result = resolveConcept(term, contextId, language, records);
  const record = result.record;
  return {
    ...result,
    knowledge: buildKnowledgeSections(record, {}),
    routing: loadRouting().domains[record?.domain] || null
  };
}

function bilingual(originalArabic, meaningTranslation, targetLanguage) {
  return require('./corpus_search').makeBilingual(originalArabic, meaningTranslation, targetLanguage);
}

module.exports = { search, concept, bilingual };
