import { getQuranExperienceConfig } from "./quran-experience.js";

const config = getQuranExperienceConfig().longPressWord;

export function getWordLongPressConfig() {
  return { ...config };
}

export function createWordLongPressController({ onLongPress, onCancel } = {}) {
  let timer = null;
  let active = false;
  let pointerId = null;
  const cancel = () => { if (timer !== null) clearTimeout(timer); timer = null; if (active && onCancel) onCancel(); active = false; pointerId = null; };
  const start = (event, wordContext) => {
    if (!config.enabled || timer !== null) return;
    active = true; pointerId = event?.pointerId ?? null;
    timer = setTimeout(() => { timer = null; if (!active) return; if (config.hapticFeedback && typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(20); if (onLongPress) onLongPress(wordContext); active = false; pointerId = null; }, config.durationMs);
  };
  const move = (event) => { if (!active) return; if (config.cancelOnMove && (pointerId === null || event?.pointerId === pointerId)) cancel(); };
  const scroll = () => { if (config.cancelOnScroll) cancel(); };
  const destroy = () => cancel();
  return { start, move, scroll, cancel, destroy, durationMs: config.durationMs };
}

export function buildWordKnowledgeRequest(wordContext) {
  return {
    type: "word-knowledge",
    word: wordContext?.word ?? null,
    root: wordContext?.root ?? null,
    morphology: wordContext?.morphology ?? null,
    surah: wordContext?.surah ?? null,
    ayah: wordContext?.ayah ?? null,
    conceptId: wordContext?.conceptId ?? null,
    sections: [...(config.panelSections || [])],
    evidencePolicy: config.evidencePolicy,
    neverTreatWordAloneAsEvidence: config.neverTreatWordAloneAsEvidence
  };
}
