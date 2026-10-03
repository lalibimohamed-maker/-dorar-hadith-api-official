(() => {
  const runtime = () => window.DeenAllahQuranRecitation;
  const state = { meta: null, options: [], qiraah: null, riwayah: null };

  function ensurePlayer() {
    let el = document.getElementById("quran-recitation-player");
    if (el) return el;
    el = document.createElement("section");
    el.id = "quran-recitation-player";
    el.className = "card";
    el.hidden = true;
    el.setAttribute("aria-live", "polite");
    el.innerHTML = `<h2>📖 تلاوة القرآن</h2>
      <p id="quran-recitation-label" class="muted"></p>
      <label for="quran-recitation-qiraah">القراءة</label>
      <select id="quran-recitation-qiraah" class="input"></select>
      <label for="quran-recitation-riwayah">الرواية</label>
      <select id="quran-recitation-riwayah" class="input"></select>
      <label for="quran-recitation-edition">القارئ / الإصدار الموثق</label>
      <select id="quran-recitation-edition" class="input"></select>
      <div class="search"><button id="quran-recitation-play" class="btn">▶️ تشغيل التلاوة</button><button id="quran-recitation-stop" class="btn secondary">⏹️ إيقاف</button></div>
      <p id="quran-recitation-source" class="muted"></p>`;
    const results = document.getElementById("results");
    (results?.parentElement || document.querySelector("main") || document.body).appendChild(el);
    el.querySelector("#quran-recitation-play").addEventListener("click", () => { const r = runtime(); if (r && state.meta) r.play(state.meta); });
    el.querySelector("#quran-recitation-stop").addEventListener("click", () => { const r = runtime(); if (r) r.stop(); });
    el.querySelector("#quran-recitation-qiraah").addEventListener("change", (event) => { state.qiraah = event.target.value; state.riwayah = null; renderRiwayat(el); renderEditions(el); });
    el.querySelector("#quran-recitation-riwayah").addEventListener("change", (event) => { state.riwayah = event.target.value; renderEditions(el); });
    el.querySelector("#quran-recitation-edition").addEventListener("change", (event) => {
      const selected = state.options.find(item => String(item.id || item.edition || item.audioUrl) === event.target.value);
      if (selected) attach({ ...selected, qiraah: state.qiraah, riwayah: state.riwayah });
    });
    return el;
  }

  function qiraatCatalog(meta) {
    return Array.isArray(meta.qiraatCatalog) ? meta.qiraatCatalog : [];
  }

  function renderQiraat(player) {
    const select = player.querySelector("#quran-recitation-qiraah");
    select.replaceChildren();
    for (const item of qiraatCatalog(state.meta || {})) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.nameAr || item.nameEn || item.id;
      select.appendChild(option);
    }
    if (state.qiraah) select.value = state.qiraah;
  }

  function renderRiwayat(player) {
    const select = player.querySelector("#quran-recitation-riwayah");
    select.replaceChildren();
    const qiraah = qiraatCatalog(state.meta || {}).find(item => item.id === state.qiraah);
    for (const id of (qiraah?.riwayat || [])) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = state.meta?.riwayat?.[id]?.nameAr || id;
      select.appendChild(option);
    }
    if (!state.riwayah && qiraah?.riwayat?.length) state.riwayah = qiraah.riwayat[0];
    if (state.riwayah) select.value = state.riwayah;
  }

  function renderEditions(player) {
    const select = player.querySelector("#quran-recitation-edition");
    select.replaceChildren();
    const compatible = state.options.filter(item =>
      item.qiraah === state.qiraah &&
      item.riwayah === state.riwayah &&
      item.audioUrl && item.source && item.reciter
    );
    for (const item of compatible) {
      const option = document.createElement("option");
      option.value = String(item.id || item.edition || item.audioUrl);
      option.textContent = item.reciter + (item.edition ? ` — ${item.edition}` : "");
      select.appendChild(option);
    }
    select.disabled = compatible.length === 0;
    if (compatible[0]) attach({ ...compatible[0], qiraah: state.qiraah, riwayah: state.riwayah });
  }

  function attach(meta = {}) {
    const r = runtime();
    if (!r || !r.validateSource(meta)) return false;
    state.meta = { ...state.meta, ...meta };
    const player = ensurePlayer();
    player.hidden = false;
    document.getElementById("quran-recitation-label").textContent = `القراءة: ${meta.qiraah || "—"} — الرواية: ${meta.riwayah || "—"} — القارئ: ${meta.reciter || "—"} — الآية: ${meta.ayah || "محددة في المصدر"}`;
    document.getElementById("quran-recitation-source").textContent = `المصدر: ${meta.source || "—"}${meta.edition ? ` — الإصدار: ${meta.edition}` : ""}`;
    return true;
  }

  function attachFromResult(result = {}) {
    const meta = result.recitation || result.quranRecitation || null;
    if (!meta) return false;
    const player = ensurePlayer();
    state.meta = meta;
    state.options = Array.isArray(meta.editions) ? meta.editions : (Array.isArray(meta.options) ? meta.options : []);
    state.qiraah = meta.qiraah || qiraatCatalog(meta)[0]?.id || null;
    state.riwayah = meta.riwayah || null;
    renderQiraat(player);
    renderRiwayat(player);
    renderEditions(player);
    return true;
  }

  window.DeenAllahQuranRecitationUI = { attach, attachFromResult };
  window.addEventListener("deen-allah:quran-recitation", (event) => {
    if (event.detail?.type === "start") {
      const player = document.getElementById("quran-recitation-player");
      if (player) player.dataset.active = "true";
    }
  });
})();
