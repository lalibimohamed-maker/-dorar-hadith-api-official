(() => {
  const runtime = () => window.DeenAllahQuranRecitation;
  const state = { meta: null, options: [] };

  function ensurePlayer() {
    let el = document.getElementById("quran-recitation-player");
    if (el) return el;
    el = document.createElement("section");
    el.id = "quran-recitation-player";
    el.className = "card";
    el.hidden = true;
    el.setAttribute("aria-live", "polite");
    el.innerHTML = `<h2>📖 تلاوة القرآن</h2><p id="quran-recitation-label" class="muted"></p><label for="quran-recitation-edition">القارئ/الإصدار الموثق</label><select id="quran-recitation-edition" class="input" hidden></select><div class="search"><button id="quran-recitation-play" class="btn">▶️ تشغيل التلاوة</button><button id="quran-recitation-stop" class="btn secondary">⏹️ إيقاف</button></div><p id="quran-recitation-source" class="muted"></p>`;
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
    el.querySelector("#quran-recitation-edition").addEventListener("change", (event) => {
      const selected = state.options.find((item) => String(item.id || item.edition || item.audioUrl) === event.target.value);
      if (selected) attach(selected);
    });
    return el;
  }

  function normalizeOptions(meta = {}) {
    const candidates = Array.isArray(meta.editions) ? meta.editions : (Array.isArray(meta.options) ? meta.options : []);
    return candidates.filter((item) => item && item.audioUrl && item.source && item.reciter);
  }

  function renderOptions(player, options) {
    const select = player.querySelector("#quran-recitation-edition");
    select.replaceChildren();
    if (options.length < 2) { select.hidden = true; return; }
    for (const item of options) {
      const option = document.createElement("option");
      option.value = String(item.id || item.edition || item.audioUrl);
      option.textContent = `${item.reciter}${item.edition ? ` — ${item.edition}` : ""}`;
      select.appendChild(option);
    }
    select.hidden = false;
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
    const player = ensurePlayer();
    state.options = normalizeOptions(meta);
    renderOptions(player, state.options);
    return attach(state.options[0] || meta);
  }

  window.DeenAllahQuranRecitationUI = { attach, attachFromResult };
  window.addEventListener("deen-allah:quran-recitation", (event) => {
    if (event.detail?.type === "start") {
      const player = document.getElementById("quran-recitation-player");
      if (player) player.dataset.active = "true";
    }
  });
})();
