import test from 'node:test';
import assert from 'node:assert/strict';
import * as recitation from '../src/rechercher-recitation-learning-engine.js';
import * as tafsir from '../src/rechercher-tafsir-sirah-engine.js';
import * as arabic from '../src/rechercher-arabic-terminology-engine.js';
import * as orchestration from '../src/rechercher-v3-learning-orchestrator.js';

test('recitation keeps canonical Arabic source-grounded and requires human verification', () => {
  const e = recitation.createRecitationLearningEngine();
  recitation.registerVerse(e, { verseId: '2:255', arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ', sourceId: 'quran-canonical', sourceHash: 'sha256:x' });
  assert.throws(() => recitation.registerVerse(e, { verseId: '2:255', arabic: 'changed', sourceId: 'quran-canonical', sourceHash: 'sha256:x' }));
  recitation.registerRecording(e, { recordingId: 'r1', verseId: '2:255', reciterId: 'reciter', audioSourceId: 'audio-1' });
  recitation.recordCandidateError(e, { recordingId: 'r1', kind: 'timing', evidence: 'candidate' });
  assert.equal(e.reviews.get('r1:timing').state, 'CANDIDATE_ERROR');
  recitation.verifyCandidate(e, { recordingId: 'r1', kind: 'timing', reviewerId: 'scholar', decision: 'CONFIRMED' });
  assert.equal(e.reviews.get('r1:timing').state, 'VERIFIED');
});

test('tafsir and sirah passages remain linked to source works and rights', () => {
  const e = tafsir.createTafsirSirahEngine();
  tafsir.registerWork(e, { workId: 'w1', domain: 'TAFSIR', title: 'Tafsir', sourceId: 'src1', sourceHash: 'h1', rightsStatus: 'ALLOWED' });
  tafsir.registerPassage(e, { passageId: 'p1', workId: 'w1', location: '1:1', text: 'text', page: 1 });
  tafsir.linkEvidence(e, { linkId: 'l1', passageId: 'p1', claimId: 'c1' });
  assert.equal(tafsir.publishableWork(e, 'w1'), true);
  tafsir.registerWork(e, { workId: 'w2', domain: 'SIRAH', title: 'Sirah', sourceId: 'src2', sourceHash: 'h2' });
  assert.equal(tafsir.publishableWork(e, 'w2'), false);
});

test('Arabic terminology aligns terms without collapsing source identity', () => {
  const e = arabic.createArabicTerminologyEngine();
  arabic.registerConcept(e, { conceptId: 'c1', label: 'الصلاة', domain: 'FIQH', sourceId: 'src' });
  arabic.registerTerm(e, { termId: 't1', conceptId: 'c1', text: 'الصلاة', sourceId: 'src' });
  arabic.registerTerm(e, { termId: 't2', conceptId: 'c1', text: 'prayer', language: 'en', register: 'USER_LANGUAGE', sourceId: 'src-en' });
  const a = arabic.alignTerms(e, { alignmentId: 'a1', termIds: ['t1', 't2'], confidence: 0.9 });
  assert.equal(a.state, 'CANDIDATE');
  assert.equal(arabic.getConceptTerms(e, 'c1').length, 2);
});

test('learning orchestrator enforces supported tracks and prerequisites', () => {
  const e = orchestration.createLearningOrchestrator();
  orchestration.registerTrack(e, { trackId: 'q', domain: 'QURAN', title: 'Quran' });
  orchestration.registerTrack(e, { trackId: 't', domain: 'TAJWEED', title: 'Tajweed', prerequisiteTrackIds: ['q'] });
  orchestration.enrollLearner(e, { learnerId: 'u1', trackId: 'q' });
  orchestration.recordCheckpoint(e, { learnerId: 'u1', trackId: 'q', checkpointId: 'c', mastery: 0.8, sourceIds: ['quran-canonical'] });
  assert.deepEqual(orchestration.nextTracks(e, 'u1').map(x => x.trackId), ['t']);
  assert.throws(() => orchestration.recordCheckpoint(e, { learnerId: 'u1', trackId: 'q', checkpointId: 'bad', mastery: 2 }));
});
