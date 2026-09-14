const RECITATION_STATES = Object.freeze([
  'REGISTERED',
  'ALIGNED',
  'CANDIDATE_ERROR',
  'REVIEW_REQUIRED',
  'VERIFIED',
]);

function createRecitationLearningEngine() {
  return { verses: new Map(), recordings: new Map(), alignments: new Map(), reviews: new Map() };
}

function registerVerse(engine, { verseId, arabic, sourceId, sourceHash }) {
  if (!verseId || !arabic || !sourceId || !sourceHash) throw new Error('verse requires canonical Arabic and source identity');
  if (engine.verses.has(verseId) && engine.verses.get(verseId).arabic !== arabic) {
    throw new Error('canonical Quran Arabic is immutable');
  }
  engine.verses.set(verseId, { verseId, arabic, sourceId, sourceHash });
  return engine.verses.get(verseId);
}

function registerRecording(engine, { recordingId, verseId, reciterId, audioSourceId }) {
  if (!engine.verses.has(verseId)) throw new Error('verse must be registered first');
  const recording = { recordingId, verseId, reciterId, audioSourceId, state: 'REGISTERED' };
  engine.recordings.set(recordingId, recording);
  return recording;
}

function alignRecording(engine, { recordingId, startMs, endMs, reviewerId = null }) {
  const recording = engine.recordings.get(recordingId);
  if (!recording || !(endMs > startMs)) throw new Error('valid recording and alignment range required');
  const alignment = { recordingId, startMs, endMs, reviewerId, state: reviewerId ? 'ALIGNED' : 'REVIEW_REQUIRED' };
  engine.alignments.set(recordingId, alignment);
  return alignment;
}

function recordCandidateError(engine, { recordingId, kind, evidence }) {
  if (!engine.recordings.has(recordingId) || !kind || !evidence) throw new Error('candidate error requires recording and evidence');
  const item = { recordingId, kind, evidence, state: 'CANDIDATE_ERROR' };
  engine.reviews.set(`${recordingId}:${kind}`, item);
  return item;
}

function verifyCandidate(engine, { recordingId, kind, reviewerId, decision, note }) {
  if (!reviewerId || !['CONFIRMED', 'REJECTED'].includes(decision)) throw new Error('human reviewer decision required');
  const key = `${recordingId}:${kind}`;
  const item = engine.reviews.get(key);
  if (!item) throw new Error('candidate error not found');
  item.state = decision === 'CONFIRMED' ? 'VERIFIED' : 'REVIEW_REQUIRED';
  item.reviewerId = reviewerId;
  item.note = note || '';
  return item;
}

module.exports = { RECITATION_STATES, createRecitationLearningEngine, registerVerse, registerRecording, alignRecording, recordCandidateError, verifyCandidate };
