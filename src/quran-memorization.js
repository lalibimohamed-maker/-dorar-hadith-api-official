import { validateMemorizationSelection, getMemorizationConfig } from "./quran-experience.js";

export function createMemorizationSession({ surah, startAyah, endAyah, repeatCount }) {
  if (!surah) throw new TypeError("اسم السورة مطلوب");
  const selection = validateMemorizationSelection(startAyah, endAyah, repeatCount);
  return {
    type: "quran-memorization",
    surah,
    ...selection,
    currentCycle: 1,
    currentAyah: selection.startAyah,
    status: "ready",
    tajweed: getMemorizationConfig().tajweedOverlay,
    instruction: "اقرأ النطاق المختار، ثم يعاد تلقائياً بالعدد الذي حدده المستخدم."
  };
}

export function advanceMemorizationCycle(session) {
  if (!session || session.type !== "quran-memorization") throw new TypeError("جلسة الحفظ غير صحيحة");
  if (session.currentCycle >= session.repeatCount) return { ...session, status: "completed" };
  return { ...session, currentCycle: session.currentCycle + 1, currentAyah: session.startAyah, status: "playing" };
}

export function getMemorizationLimits() {
  const m = getMemorizationConfig();
  return { minAyahs: m.minAyahs, maxAyahs: m.maxAyahs, minRepeats: m.minRepeats, maxRepeats: m.maxRepeats };
}
