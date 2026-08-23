(() => {
  const runtime = () => window.DeenAllahQuranRecitation;
  const state = { meta: null };

  function ensurePlayer() {
    let el = document.getElementById("quran-recitation-player");
    if (el) return el;
    el = document.createElement("section");
    el.id = "quran-recitation-player";
    el.className = "card";
    el.hidden = true;
    el.setAttribute("aria-live", "polite");
    el.innerHTML = `<h2>📖 تلاوة القرآن</h2><p id="quran-recitation-label" class="muted"></p><div class="search"><button id="quran-recitation-play" class="btn">▶️ تشغيل التلاوة</button><button id="quran-recitation-stop" class="btn secondary">⏹️ إيقاف</button></div><p id="quran-recitation-source" class="muted"></p>`;
    const results = document.getElementById("results");
    (results?.parentElement || document.querySelector("main") || document.body).appendChild(el);
    el.querySelector("#quran-recitation-play").addEventListener("click", () => {
      const r = runtime();
      if (r && state.meta) r.play(state.meta);
    });
    el.querySelector("#quran-recitation-stop").addEventListener("click", () => {
      const r = runtime();
      if (r) r.stop();
    });
    return el;
  }

  function attach(meta = {}) {
    const r = runtime();
    if (!r || !r.validateSource(meta)) return false;
    state.meta = { ...meta };
    const player = ensurePlayer();
    player.hidden = false;
    document.getElementById("quran-recitation-label").textContent = `القارئ: ${meta.reciter} — الآية: ${meta.ayah || "محددة في المصدر"}`;
    document.getElementById("quran-recitation-source").textContent = `المصدر: ${meta.source}${meta.edition ? ` — الإصدار: ${meta.edition}` : ""}`;
    return true;
  }

  function attachFromResult(result = {}) {
    const meta = result.recitation || result.quranRecitation || null;
    if (!meta) return false;
    return attach(meta);
  }

  window.DeenAllahQuranRecitationUI = { attach, attachFromResult };
  window.addEventListener("deen-allah:quran-recitation", (event) => {
    if (event.detail?.type === "start") {
      const player = document.getElementById("quran-recitation-player");
      if (player) player.dataset.active = "true";
    }
  });
})();
