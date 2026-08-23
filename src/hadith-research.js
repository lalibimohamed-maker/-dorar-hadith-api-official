import { findHadithBook, listHadithBooks, validateHadithRecord } from './hadith-corpus.js';
import { buildNarratorResearchProfile, compareNarratorJudgments, findNarratorGrade, listCoreRijalBooks } from './hadith-narrator-methodology.js';

export function hadithSource(sourceId) { return findHadithBook(sourceId); }
export function hadithSources() { return listHadithBooks(); }
export function validateHadith(record) { return validateHadithRecord(record); }
export function narratorProfile(input) { return buildNarratorResearchProfile(input); }
export function compareNarratorJudgmentsSafe(judgments) { return compareNarratorJudgments(judgments); }
export function narratorGrade(id) { return findNarratorGrade(id); }
export function rijalBooks() { return listCoreRijalBooks(); }
