export function createQuranLearningEngine() {
  return { verses: new Map(), translations: new Map(), exercises: new Map() };
}

export function registerVerse(engine, { verseId, surah, ayah, arabic, sourceId, sourceHash } = {}) {
  if (!verseId || !surah || !ayah || !arabic || !sourceId || !sourceHash) throw new TypeError('Verse requires identity, Arabic text, source and source hash');
  if (engine.verses.has(verseId)) throw new Error(`Duplicate verse: ${verseId}`);
  engine.verses.set(verseId, { verseId, surah, ayah, arabic, sourceId, sourceHash });
  return verseId;
}

export function registerTranslation(engine, { translationId, verseId, language, text, sourceId, rightsStatus = 'UNKNOWN' } = {}) {
  if (!translationId || !verseId || !language || !text || !sourceId) throw new TypeError('Translation requires identity, verse, language, text and source');
  if (!engine.verses.has(verseId)) throw new Error(`Unknown verse: ${verseId}`);
  engine.translations.set(translationId, { translationId, verseId, language, text, sourceId, rightsStatus });
  return translationId;
}

export function createRecallExercise(engine, { exerciseId, verseId, type = 'LOCATION', prompt, sourceIds = [] } = {}) {
  if (!exerciseId || !verseId || !prompt) throw new TypeError('Recall exercise requires identity, verse and prompt');
  if (!engine.verses.has(verseId)) throw new Error(`Unknown verse: ${verseId}`);
  const exercise = { exerciseId, verseId, type, prompt, sourceIds: [...sourceIds], status: 'SOURCE_LINKED' };
  engine.exercises.set(exerciseId, exercise);
  return exercise;
}
