import { loadCorpus, loadRouting } from './corpus_repository.js';
import { searchCorpus, resolveConcept } from './corpus_search.js';
import { buildKnowledgeSections } from './concept_resolver.js';
import { buildGhaybResearchPlan } from './ghayb-router.js';
import { queryPolicy } from './query-intent-router.js';
import { routeSpecializedQuestion, getEngine } from './specialized-engines.js';
import { getWorshipLearningConfig, detectWorshipTopic, createLearningSession } from './worship-learning-engine.js';
import { routeTransactionQuestion, buildTransactionLesson, listTransactionTopics } from './transactions-riba-engine.js';
import { searchEncyclopedia, getEncyclopediaSourceInfo, getEncyclopediaDomainInfo } from './encyclopedia-api.js';
import { hadithSource, hadithSources, validateHadith, narratorProfile, compareNarratorJudgmentsSafe, narratorGrade, rijalBooks } from './hadith-research.js';
import { validateNarratorRecord, summarizeNarratorEvidence, compareNarratorStatements } from './rijal-evidence.js';

export function search(query, options = {}) {
  const records = loadCorpus();
  const policy = queryPolicy(query);
  const specialized = routeSpecializedQuestion(query);
  const result = searchCorpus(query, { ...options, queryPolicy: policy }, records);
  const ghaibPlan = policy.intent === 'ghaib' ? buildGhaybResearchPlan(query, options) : null;
  const encyclopedia = searchEncyclopedia(query, options);
  return { ...result, queryPolicy: policy, specializedRouting: specialized, ghaibResearch: ghaibPlan, encyclopedia };
}
export function encyclopediaSearch(query, options = {}) { return searchEncyclopedia(query, options); }
export function encyclopediaSource(sourceId) { return getEncyclopediaSourceInfo(sourceId); }
export function encyclopediaDomain(domain) { return getEncyclopediaDomainInfo(domain); }
export function hadithCatalog() { return hadithSources(); }
export function hadithBook(sourceId) { return hadithSource(sourceId); }
export function hadithRecordValidation(record) { return validateHadith(record); }
export function hadithNarratorProfile(input) { return narratorProfile(input); }
export function hadithNarratorJudgmentComparison(judgments) { return compareNarratorJudgmentsSafe(judgments); }
export function hadithNarratorGrade(id) { return narratorGrade(id); }
export function hadithRijalBooks() { return rijalBooks(); }
export function narratorEvidence(record) { return { validation: validateNarratorRecord(record), summary: summarizeNarratorEvidence(record), statements: compareNarratorStatements(record) }; }

export function concept(term, contextId, language = 'ar', options = {}) {
  const records = loadCorpus();
  const result = resolveConcept(term, contextId, language, records, options);
  const record = result.record;
  const knowledge = buildKnowledgeSections(record, record?.knowledge || {}, options);
  const ghaibPlan = buildGhaybResearchPlan(term, { ...options, language });
  return { ...result, knowledge, ghaibResearch: ghaibPlan, queryPolicy: queryPolicy(term), specializedRouting: routeSpecializedQuestion(term), routing: loadRouting().domains?.[record?.domain] || null };
}
export function specializedEngine(id) { return getEngine(id); }
export function worshipLearning({ topic, question, audience='general', language='ar', mode='guided' } = {}) {
  const detected = topic || detectWorshipTopic(question || '');
  return { config: getWorshipLearningConfig(), session: createLearningSession({ topic: detected, audience, language, mode }), detectedTopic: detected };
}
export function transactionLearning({ topic, question, language='ar' } = {}) {
  const routing = question ? routeTransactionQuestion(question) : { engineId:'fiqh-transactions', topicId:topic || null, confidence: topic ? 1 : 0.1, candidates: [] };
  const selected = topic || routing.topicId;
  return { routing, topics: listTransactionTopics(), lesson: selected ? buildTransactionLesson(selected, { language }) : null };
}
