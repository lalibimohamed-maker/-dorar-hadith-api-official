import { loadCorpus, loadRouting } from './corpus_repository.js';
import { searchCorpus, resolveConcept, makeBilingual } from './corpus_search.js';
import { buildKnowledgeSections } from './concept_resolver.js';
import { buildGhaybResearchPlan } from './ghayb-router.js';
import { queryPolicy } from './query-intent-router.js';

export function search(query, options = {}) {
  const records = loadCorpus();
  const policy = queryPolicy(query);
  const result = searchCorpus(query, { ...options, queryPolicy: policy }, records);
  const ghaibPlan = policy.intent === 'ghaib' ? buildGhaybResearchPlan(query, options) : null;
  return { ...result, queryPolicy: policy, ghaibResearch: ghaibPlan };
}

export function concept(term, contextId, language = 'ar', options = {}) {
  const records = loadCorpus();
  const result = resolveConcept(term, contextId, language, records, options);
  const record = result.record;
  const knowledge = buildKnowledgeSections(record, record?.knowledge || {}, options);
  const ghaibPlan = buildGhaybResearchPlan(term, { ...options, language });
  return {
    ...result,
    knowledge,
    ghaibResearch: ghaibPlan,
    queryPolicy: queryPolicy(term),
    routing: loadRouting().domains?.[record?.domain] || null
  };
}

export function bilingual(originalArabic, meaningTranslation, targetLanguage) {
  return makeBilingual(originalArabic, meaningTranslation, targetLanguage);
}
