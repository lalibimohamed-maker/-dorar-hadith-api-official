import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuranLearningEngine, registerVerse, registerTranslation, createRecallExercise } from '../src/rechercher-quran-learning-engine.js';
import { createHadithEvidenceEngine, registerHadith, addTransmissionPath, addScholarlyGrading, summarizeHadithEvidence } from '../src/rechercher-hadith-evidence-engine.js';
import { createFiqhEngine, registerIssue, addMadhhabPosition, compareMadhahib } from '../src/rechercher-fiqh-madhhab-engine.js';
import { createMasteryEngine, registerMasteryConcept, recordMasteryAttempt, masteryState, nextPrerequisite } from '../src/rechercher-mastery-engine.js';

test('Quran learning remains source-linked and keeps Arabic text immutable in the engine', () => {
  const e = createQuranLearningEngine();
  registerVerse(e, { verseId: '2:255', surah: 2, ayah: 255, arabic: 'نص أصلي', sourceId: 'quran-source', sourceHash: 'sha256:x' });
  registerTranslation(e, { translationId: 'fr:2:255', verseId: '2:255', language: 'fr', text: 'traduction', sourceId: 'translation-source', rightsStatus: 'ALLOWED' });
  const exercise = createRecallExercise(e, { exerciseId: 'x1', verseId: '2:255', prompt: 'أين الآية؟' });
  assert.equal(e.verses.get('2:255').arabic, 'نص أصلي');
  assert.equal(exercise.status, 'SOURCE_LINKED');
});

test('Hadith evidence preserves transmission and scholarly grading separately', () => {
  const e = createHadithEvidenceEngine();
  registerHadith(e, { hadithId: 'h1', text: 'حديث', sourceId: 'book:1', sourceHash: 'sha256:h' });
  addTransmissionPath(e, { hadithId: 'h1', pathId: 'p1', narrators: ['n1', 'n2'], sourceIds: ['book:1'] });
  addScholarlyGrading(e, { gradingId: 'g1', hadithId: 'h1', scholarId: 's1', grade: 'HASAN', sourceIds: ['grading:1'] });
  const summary = summarizeHadithEvidence(e, 'h1');
  assert.equal(summary.transmissionPaths.length, 1);
  assert.equal(summary.scholarlyGradings[0].grade, 'HASAN');
});

test('Fiqh comparison keeps four madhhab positions distinct', () => {
  const e = createFiqhEngine();
  registerIssue(e, { issueId: 'i1', title: 'مسألة', sourceIds: ['book:1'] });
  for (const madhhab of ['HANAFI', 'MALIKI', 'SHAFII', 'HANBALI']) addMadhhabPosition(e, { positionId: madhhab, issueId: 'i1', madhhab, statement: `قول ${madhhab}`, sourceIds: ['book:1'] });
  assert.equal(compareMadhahib(e, 'i1').length, 4);
});

test('Mastery engine models prerequisites and repeated performance', () => {
  const e = createMasteryEngine();
  registerMasteryConcept(e, { conceptId: 'advanced', domain: 'fiqh', prerequisites: ['basic'] });
  registerMasteryConcept(e, { conceptId: 'basic', domain: 'fiqh' });
  assert.equal(nextPrerequisite(e, 'advanced', new Set()), 'basic');
  for (let i = 0; i < 4; i += 1) recordMasteryAttempt(e, { attemptId: `a${i}`, learnerId: 'u1', conceptId: 'advanced', correct: true, confidence: 0.9 });
  assert.equal(masteryState(e, 'u1', 'advanced'), 'MASTERED');
});
