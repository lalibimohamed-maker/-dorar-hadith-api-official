(() => {
  const domains = {
    quran: 'القرآن وعلومه', ulumQuran: 'علوم القرآن', tajweed: 'التجويد', recitation: 'قراءة وتسميع وتصحيح',
    hadith: 'الحديث وعلومه', mustalah: 'أصول الحديث', fiqh: 'الفقه', usulFiqh: 'أصول الفقه',
    furuuFiqh: 'فروع الفقه', seerah: 'السيرة', prophets: 'قصص الأنبياء', quranStories: 'قصص القرآن',
    hadithStories: 'قصص ومواعظ الحديث', aqeedah: 'العقيدة', rijal: 'الرجال والجرح والتعديل', maqasid: 'المقاصد',
    faraid: 'الفرائض', arabic: 'اللغة العربية', mixed: 'اختبار شامل'
  };

  const state = {
    domain: 'mixed', level: 'beginner', mode: 'exam', questions: [], index: 0, score: 0,
    flashcards: [], flashIndex: 0, flashDue: []
  };

  function normalize(record = {}) {
    return {
      id: String(record.id || crypto.randomUUID()), domain: record.domain || 'mixed', topic: record.topic || 'عام',
      level: record.level || record.difficulty || 'beginner', type: record.type || 'mcq',
      question: record.question || record.front || '', options: Array.isArray(record.options) ? record.options : (record.choices || []),
      answer: record.answer ?? null, explanation: record.explanation || '', source: record.source || null,
      sourceUrl: record.sourceUrl || null, status: record.status || 'reviewed',
      front: record.front || record.question || '', back: record.back || record.explanation || '',
      practical: record.practical || null
    };
  }

  function isPublishable(q) { return q.question && q.answer !== null && q.status !== 'blocked' && q.source; }
  function filter(records, domain = state.domain, level = state.level) {
    const usable = records.map(normalize).filter(isPublishable);
    return usable.filter(q => (domain === 'mixed' || q.domain === domain) && (level === 'all' || q.level === level));
  }
  function shuffle(items) {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function start(records, { domain = 'mixed', level = 'beginner', count = 10, mode = 'exam' } = {}) {
    state.domain = domain; state.level = level; state.mode = mode; state.score = 0; state.index = 0;
    state.questions = shuffle(filter(records, domain, level)).slice(0, Math.max(1, count));
    return getCurrent();
  }
  function getCurrent() { return state.questions[state.index] || null; }
  function answer(value) {
    const q = getCurrent(); if (!q) return { done: true, score: state.score };
    const correct = String(value) === String(q.answer); if (correct) state.score += 1;
    return { correct, question: q, score: state.score, position: state.index + 1, total: state.questions.length };
  }
  function next() { state.index += 1; return getCurrent(); }
  function progress() { return { score: state.score, answered: Math.min(state.index, state.questions.length), total: state.questions.length }; }

  // Flashcards use the same reviewed/source-grounded records but add a deliberate recall step.
  function startFlashcards(records, { domain = 'mixed', level = 'all', count = 12 } = {}) {
    state.domain = domain; state.level = level; state.mode = 'flashcards'; state.flashIndex = 0;
    state.flashcards = shuffle(filter(records, domain, level)).slice(0, Math.max(1, count));
    state.flashDue = state.flashcards.map(q => ({ id: q.id, rating: null }));
    return getFlashcard();
  }
  function getFlashcard() { return state.flashcards[state.flashIndex] || null; }
  function rateFlashcard(rating) {
    const q = getFlashcard(); if (!q) return { done: true };
    const item = state.flashDue.find(x => x.id === q.id); if (item) item.rating = rating;
    // Again = repeat soon, Hard = keep near the front, Good = continue, Easy = postpone.
    if (rating === 'again') state.flashcards.push(q);
    if (rating === 'hard') state.flashcards.splice(Math.min(state.flashIndex + 2, state.flashcards.length), 0, q);
    state.flashIndex += 1;
    return { card: getFlashcard(), rating, reviewed: q, remaining: Math.max(0, state.flashcards.length - state.flashIndex) };
  }

  window.DeenAllahSelfTest = {
    domains, state, normalize, filter, start, getCurrent, answer, next, progress,
    startFlashcards, getFlashcard, rateFlashcard
  };
})();
