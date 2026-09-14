const TRACKS = Object.freeze([
  'QURAN', 'TAJWEED', 'HADITH', 'RIJAL', 'TAFSIR', 'FIQH', 'USUL_AL_FIQH', 'SIRAH', 'AQIDAH', 'ARABIC'
]);

function createLearningOrchestrator() {
  return { tracks: new Map(), enrollments: new Map(), checkpoints: new Map() };
}

function registerTrack(engine, { trackId, domain, title, conceptIds = [], prerequisiteTrackIds = [] }) {
  if (!trackId || !TRACKS.includes(domain) || !title) throw new Error('track requires supported domain and identity');
  const track = { trackId, domain, title, conceptIds: [...conceptIds], prerequisiteTrackIds: [...prerequisiteTrackIds] };
  engine.tracks.set(trackId, track);
  return track;
}

function enrollLearner(engine, { learnerId, trackId, role = 'STUDENT' }) {
  if (!engine.tracks.has(trackId) || !learnerId) throw new Error('track must exist before enrollment');
  const enrollment = { learnerId, trackId, role, state: 'ACTIVE' };
  engine.enrollments.set(`${learnerId}:${trackId}`, enrollment);
  return enrollment;
}

function recordCheckpoint(engine, { learnerId, trackId, checkpointId, mastery, sourceIds = [], reviewerId = null }) {
  const key = `${learnerId}:${trackId}`;
  if (!engine.enrollments.has(key)) throw new Error('learner must be enrolled first');
  if (!(mastery >= 0 && mastery <= 1)) throw new Error('mastery must be between 0 and 1');
  const checkpoint = { learnerId, trackId, checkpointId, mastery, sourceIds: [...sourceIds], reviewerId, state: reviewerId ? 'REVIEWED' : 'RECORDED' };
  engine.checkpoints.set(`${key}:${checkpointId}`, checkpoint);
  return checkpoint;
}

function nextTracks(engine, learnerId) {
  const active = [...engine.enrollments.values()].filter(e => e.learnerId === learnerId && e.state === 'ACTIVE').map(e => e.trackId);
  return [...engine.tracks.values()].filter(track => !active.includes(track.trackId) && track.prerequisiteTrackIds.every(id => active.includes(id)));
}

module.exports = { TRACKS, createLearningOrchestrator, registerTrack, enrollLearner, recordCheckpoint, nextTracks };
