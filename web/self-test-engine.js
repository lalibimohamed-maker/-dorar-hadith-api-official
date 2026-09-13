(() => {
  const domains = {
    quran: 'القرآن وعلومه', hadith: 'الحديث وعلومه', mustalah: 'أصول الحديث',
    fiqh: 'الفقه', usulFiqh: 'أصول الفقه', seerah: 'السيرة', prophets: 'قصص الأنبياء',
    quranStories: 'قصص القرآن', hadithStories: 'قصص ومواعظ الحديث', mixed: 'اختبار شامل'
  };

  const state = { domain: 'mixed', level: 'beginner', questions: [], index: 0, score: 0 };

  function normalize(record = {}) {
    return {
      id: String(record.id || crypto.randomUUID()),
      domain: record.domain || 'mixed',
      topic: record.topic || 'عام',
      level: record.level || 'beginner',
      type: record.type || 'mcq',
      question: record.question || '',
      options: Array.isArray(record.options) ? record.options : [],
      answer: record.answer ?? null,
      explanation: record.explanation || '',
      source: record.source || null,
      sourceUrl: record.sourceUrl || null,
      status: record.status || 'reviewed'
    };
  }

  function isPublishable(q) {
    return q.question && q.answer !== null && q.status !== 'blocked' && q.source;
  }

  function filter(records, domain = state.domain, level = state.level) {
    const usable = records.map(normalize).filter(isPublishable);
    return usable.filter(q => (domain === 'mixed' || q.domain === domain) && (level === 'all' || q.level === level));
  }

  function shuffle(items) {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function start(records, { domain = 'mixed', level = 'beginner', count = 10 } = {}) {
    state.domain = domain; state.level = level; state.score = 0; state.index = 0;
    state.questions = shuffle(filter(records, domain, level)).slice(0, Math.max(1, count));
    return getCurrent();
  }

  function getCurrent() {
    return state.questions[state.index] || null;
  }

  function answer(value) {
    const q = getCurrent();
    if (!q) return { done: true, score: state.score };
    const correct = String(value) === String(q.answer);
    if (correct) state.score += 1;
    return { correct, question: q, score: state.score, position: state.index + 1, total: state.questions.length };
  }

  function next() {
    state.index += 1;
    return getCurrent();
  }

  function progress() {
    return { score: state.score, answered: Math.min(state.index, state.questions.length), total: state.questions.length };
  }

  window.DeenAllahSelfTest = { domains, state, normalize, filter, start, getCurrent, answer, next, progress };
})();
