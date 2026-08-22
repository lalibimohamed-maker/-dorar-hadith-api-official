import { loadCorpus, loadRouting } from './corpus_repository.js';
import { searchCorpus, resolveConcept, makeBilingual } from './corpus_search.js';
import { buildKnowledgeSections } from './concept_resolver.js';
export function search(query,options={}) { return searchCorpus(query,options,loadCorpus()); }
export function concept(term,contextId,language='ar') { const records=loadCorpus(); const result=resolveConcept(term,contextId,language,records); const record=result.record; return {...result,knowledge:buildKnowledgeSections(record,{}),routing:loadRouting().domains[record?.domain]||null}; }
export function bilingual(originalArabic,meaningTranslation,targetLanguage) { return makeBilingual(originalArabic,meaningTranslation,targetLanguage); }
