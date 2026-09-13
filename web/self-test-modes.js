(() => {
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  let bank = null;
  let card = null;
  let shown = false;
  let reviewed = 0;
  let known = 0;

  async function load() {
    const r = await fetch('../config/self-test-questions-2026.json', { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    bank = await r.json();
    bind();
  }

  function pool() {
    if (!bank) return [];
    const domain = $('test-domain').value;
    const difficulty = $('difficulty').value;
    return bank.questions.filter(q => (domain === 'mixed' || q.domain === domain) && (difficulty === 'all' || q.difficulty === difficulty));
  }

  function next() {
    const items = pool();
    if (!items.length) { $('flashcard').innerHTML = '<p class="error">لا توجد بطاقات موثقة لهذا الاختيار بعد.</p>'; return; }
    card = items[Math.floor(Math.random() * items.length)];
    shown = false;
    render();
  }

  function render() {
    if (!card) return;
    $('flashcard').innerHTML = `<h3>${esc(card.question)}</h3>${shown ? `<div class="flash-answer"><strong>الإجابة:</strong> ${esc(card.choices?.[card.answer] ?? card.answer)}<p>${esc(card.explanation)}</p><small>المصدر: ${esc(card.source)}</small></div>` : '<p>استرجع الجواب من ذاكرتك قبل كشف البطاقة.</p>'}`;
    $('show-flash-answer').disabled = shown;
  }

  function rate(rating) {
    if (!card) return;
    reviewed += 1;
    if (rating === 'good' || rating === 'easy') known += 1;
    $('score').textContent = `${known}/${reviewed}`;
    next();
  }

  function setMode() {
    const flash = $('learning-mode').value === 'flashcards';
    $('question-card').classList.toggle('hidden', flash);
    $('flashcard-card').classList.toggle('hidden', !flash);
    if (flash) next();
  }

  function bind() {
    $('learning-mode').addEventListener('change', setMode);
    $('test-domain').addEventListener('change', () => { if ($('learning-mode').value === 'flashcards') next(); });
    $('difficulty').addEventListener('change', () => { if ($('learning-mode').value === 'flashcards') next(); });
    $('show-flash-answer').addEventListener('click', () => { shown = true; render(); });
    document.querySelectorAll('.flash-rate').forEach(b => b.addEventListener('click', () => rate(b.dataset.rating)));
    setMode();
  }

  load().catch(error => { $('flashcard').innerHTML = `<div class="error">تعذر تحميل البطاقات: ${esc(error.message)}</div>`; });
})();
