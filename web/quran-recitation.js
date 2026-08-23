(() => {
  const RECITATION_EVENT = "deen-allah:quran-recitation";
  const state = { audio: null, active: false };

  function isQuranRecord(meta = {}) {
    const domain = String(meta.domain || meta.category || "").toLowerCase();
    return ["quran", "quran-ayah", "quran-verse", "recitation"].includes(domain);
  }

  function validateSource(meta = {}) {
    return Boolean(isQuranRecord(meta) && meta.audioUrl && meta.source && meta.reciter);
  }

  function stop() {
    if (state.audio) { state.audio.pause(); state.audio.currentTime = 0; }
    state.active = false;
  }

  function play(meta = {}) {
    if (!validateSource(meta)) return false;
    stop();
    const audio = new Audio(meta.audioUrl);
    audio.preload = "metadata";
    audio.addEventListener("ended", () => { state.active = false; });
    state.audio = audio;
    state.active = true;
    window.dispatchEvent(new CustomEvent(RECITATION_EVENT, { detail: { type: "start", source: meta.source, reciter: meta.reciter, ayah: meta.ayah || null } }));
    audio.play().catch(() => { state.active = false; });
    return true;
  }

  window.DeenAllahQuranRecitation = { play, stop, isQuranRecord, validateSource, eventName: RECITATION_EVENT, get active() { return state.active; } };
})();
