(() => {
  const state = { bank: null, domain: "mixed", difficulty: "all", current: null, score: 0, asked: 0, answered: false, stream: null, recorder: null, chunks: [] };
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

  async function loadBank() {
    const response = await fetch("../config/self-test-questions-2026.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.bank = await response.json();
    renderDomains();
    renderStats();
    nextQuestion();
  }

  function renderDomains() {
    const select = $("test-domain");
    select.innerHTML = state.bank.domains.map(d => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.icon)} ${escapeHtml(d.name_ar)}</option>`).join("");
    select.value = "mixed";
  }

  function pool() {
    return state.bank.questions.filter(q => (state.domain === "mixed" || q.domain === state.domain) && (state.difficulty === "all" || q.difficulty === state.difficulty));
  }

  function nextQuestion() {
    const questions = pool();
    if (!questions.length) {
      $("question").innerHTML = "<p class='error'>لا توجد أسئلة في هذا المجال والمستوى حالياً. أضف أسئلة موثقة إلى بنك الأسئلة.</p>";
      return;
    }
    const previous = state.current?.id;
    const candidates = questions.filter(q => q.id !== previous);
    state.current = (candidates.length ? candidates : questions)[Math.floor(Math.random() * (candidates.length || questions.length))];
    state.answered = false;
    renderQuestion();
  }

  function renderQuestion() {
    const q = state.current;
    $("question").innerHTML = `<div class="question-head"><span>السؤال ${state.asked + 1}</span><span>${escapeHtml(q.difficulty)}</span></div><h2>${escapeHtml(q.question)}</h2><div class="choices">${q.choices.map((choice, i) => `<button class="choice" data-choice="${i}">${String.fromCharCode(65 + i)} — ${escapeHtml(choice)}</button>`).join("")}</div><div id="feedback" aria-live="polite"></div>`;
    document.querySelectorAll(".choice").forEach(button => button.addEventListener("click", () => answer(Number(button.dataset.choice))));
    renderStats();
  }

  function answer(choice) {
    if (state.answered) return;
    state.answered = true;
    state.asked += 1;
    const correct = choice === state.current.answer;
    if (correct) state.score += 1;
    document.querySelectorAll(".choice").forEach((button, i) => {
      button.disabled = true;
      if (i === state.current.answer) button.classList.add("correct");
      if (i === choice && !correct) button.classList.add("wrong");
    });
    $("feedback").innerHTML = `<div class="feedback ${correct ? "good" : "bad"}"><strong>${correct ? "✅ أحسنت!" : "❌ ليست الإجابة الصحيحة"}</strong><p>${escapeHtml(state.current.explanation)}</p><small>المصدر: ${escapeHtml(state.current.source)}</small></div>`;
    renderStats();
  }

  function renderStats() {
    $("score").textContent = `${state.score}/${state.asked}`;
  }

  function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ar-SA";
    utterance.rate = 0.78;
    window.speechSynthesis.speak(utterance);
  }

  function renderAssessment(result) {
    const words = Array.isArray(result?.words) ? result.words : [];
    if (!words.length) {
      $("recitation-result").innerHTML = `<div class="status">لم يصل تقرير تصحيح آلي بعد. يمكن توصيل محرك التقييم لاحقاً دون تغيير واجهة الموسوعة.</div>`;
      return;
    }
    $("recitation-result").innerHTML = `<h3>نتيجة التلاوة</h3><div class="tajweed-line">${words.map(w => `<button class="tajweed-word ${w.ok ? "ok" : "error-word"}" data-pronounce="${escapeHtml(w.correction || w.reference || w.word)}">${escapeHtml(w.word)}</button>`).join(" ")}</div><p class="muted">اضغط على الكلمة المعلّمة لسماع النطق المرجعي. ويجب أن يوضح محرك التقييم نوع الخطأ وموضعه ومصدر القاعدة.</p>`;
    document.querySelectorAll("[data-pronounce]").forEach(el => el.addEventListener("click", () => speak(el.dataset.pronounce)));
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      $("recitation-result").innerHTML = "<div class='error'>المتصفح لا يدعم تسجيل الصوت المطلوب.</div>";
      return;
    }
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.chunks = [];
      state.recorder = new MediaRecorder(state.stream);
      state.recorder.ondataavailable = event => { if (event.data.size) state.chunks.push(event.data); };
      state.recorder.onstop = () => {
        state.stream?.getTracks().forEach(t => t.stop());
        $("recitation-result").innerHTML = `<div class="status">🎙️ تم تسجيل التلاوة محلياً. هذه النسخة لا تدّعي تصحيح التجويد آلياً حتى يُوصل محرك تقييم موثوق؛ يمكن إرسال التسجيل إلى طبقة تقييم مصرح بها وفق سياسة الخصوصية.</div>`;
      };
      state.recorder.start();
      $("record").disabled = true;
      $("stop-record").disabled = false;
      $("record-status").textContent = "🔴 التسجيل جارٍ…";
    } catch (error) {
      $("recitation-result").innerHTML = `<div class="error">تعذر الوصول إلى الميكروفون: ${escapeHtml(error.message)}</div>`;
    }
  }

  function stopRecording() {
    if (state.recorder?.state === "recording") state.recorder.stop();
    $("record").disabled = false;
    $("stop-record").disabled = true;
    $("record-status").textContent = "تم إيقاف التسجيل.";
  }

  $("test-domain").addEventListener("change", e => { state.domain = e.target.value; state.asked = 0; state.score = 0; nextQuestion(); });
  $("difficulty").addEventListener("change", e => { state.difficulty = e.target.value; state.asked = 0; state.score = 0; nextQuestion(); });
  $("next").addEventListener("click", nextQuestion);
  $("record").addEventListener("click", startRecording);
  $("stop-record").addEventListener("click", stopRecording);
  $("qatar-tajweed").addEventListener("click", () => window.open("https://alquran.islam.gov.qa/droos/Sections.html", "_blank", "noopener"));

  loadBank().catch(error => { $("question").innerHTML = `<div class="error">تعذر تحميل بنك الأسئلة: ${escapeHtml(error.message)}</div>`; });
})();
