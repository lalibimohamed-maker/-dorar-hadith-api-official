import { openItiConnectorInfo, openItiVersion, openItiRawTextUrl, openItiRawText, openItiConnectorHealth, shamelaDiscoveryUrl, shamelaConnectorInfo } from './rechercher-openiti-shamela.js';
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
import { apiActivationRegistry, apiActivation } from './api-activation.js';
import { getQuranAyah } from './quran-ayah.js';
import { listQuranTranslations, getQuranTranslation, getQuranFoundationTranslation } from './quran-translations.js';
import { syncQuranFoundation } from './quran-foundation-sync.js';
import { searchDorar } from './dorar-client.js';
import { getSunnahCollections, getSunnahCollection, getSunnahHadiths, getSunnahHadithByRefs, getSunnahHadithByUrns } from './sunnah-client.js';
import { islamHouseConnectorInfo, islamHouseCategories, islamHouseCategoryItems, islamHouseItem, islamHouseItemTranslations, islamHouseAvailableLanguages, islamHouseLatest, islamHouseBooks, gallicaSearch, fetchIiifManifest, iiifConnectorInfo, sourceConnectorHealth } from './rechercher-source-connectors.js';
import { hadeethEncApiInfo, hadeethEncLanguages, hadeethEncCategories, hadeethEncRootCategories, hadeethEncList, hadeethEncHadith } from './hadeethenc-client.js';

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

export function apiRegistry() { return apiActivationRegistry(); }
export function apiConnector(id) { return apiActivation(id); }
export function quranAyah(input) { return getQuranAyah(input); }
export function quranTranslations(language) { return listQuranTranslations(language); }
export function quranTranslation(input) { return getQuranTranslation(input); }
export function quranFoundationTranslation(input) { return getQuranFoundationTranslation(input); }
export function quranFoundationSync(input) { return syncQuranFoundation(input); }
export function dorarSearch(query, options) { return searchDorar(query, options); }
export function sunnahHadiths(input) { return getSunnahHadiths(input); }
export function sunnahHadithRefs(refs, options) { return getSunnahHadithByRefs(refs, options); }
export function sunnahHadithUrns(urns, options) { return getSunnahHadithByUrns(urns, options); }
export function sunnahCollections(options) { return getSunnahCollections(options); }
export function sunnahCollection(collection, options) { return getSunnahCollection(collection, options); }

export function hadeethEncInfo() { return hadeethEncApiInfo(); }
export function hadeethEncLanguagesList() { return hadeethEncLanguages(); }
export function hadeethEncCategoriesList(language) { return hadeethEncCategories(language); }
export function hadeethEncRootCategoriesList(language) { return hadeethEncRootCategories(language); }
export function hadeethEncHadithList(input) { return hadeethEncList(input); }
export function hadeethEncHadithRecord(input) { return hadeethEncHadith(input); }

export function rechercherSourceConnectorHealth() { return sourceConnectorHealth(); }
export function rechercherIslamHouseInfo() { return islamHouseConnectorInfo(); }
export function rechercherIslamHouseCategories(language) { return islamHouseCategories(language); }
export function rechercherIslamHouseCategoryItems(input) { return islamHouseCategoryItems(input); }
export function rechercherIslamHouseItem(itemId, language) { return islamHouseItem(itemId, language); }
export function rechercherIslamHouseItemTranslations(itemId, language) { return islamHouseItemTranslations(itemId, language); }
export function rechercherIslamHouseAvailableLanguages(contentType, language) { return islamHouseAvailableLanguages(contentType, language); }
export function rechercherIslamHouseLatest(input) { return islamHouseLatest(input); }
export function rechercherIslamHouseBooks(input) { return islamHouseBooks(input); }
export function rechercherGallicaSearch(input) { return gallicaSearch(input); }
export function rechercherIiifManifest(input) { return fetchIiifManifest(input.provider, input.url, input); }
export function rechercherIiifConnectorInfo() { return iiifConnectorInfo(); }

export function rechercherOpenItiInfo() { return openItiConnectorInfo(); }
export function rechercherOpenItiVersion(versionUri, options) { return openItiVersion(versionUri, options); }
export function rechercherOpenItiRawTextUrl(input) { return openItiRawTextUrl(input); }
export function rechercherOpenItiRawText(input) { return openItiRawText(input); }
export function rechercherOpenItiHealth() { return openItiConnectorHealth(); }
export function rechercherShamelaDiscoveryUrl(query) { return shamelaDiscoveryUrl(query); }
export function rechercherShamelaInfo() { return shamelaConnectorInfo(); }
