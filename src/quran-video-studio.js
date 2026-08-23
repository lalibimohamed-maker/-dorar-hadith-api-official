import { getReciterRegistry } from "./quran-experience.js";

export function createQuranVideoProject({ selections, reciterId, background }) {
  if (!Array.isArray(selections) || selections.length === 0) throw new TypeError("اختر آية أو نطاقًا أو سورة واحدة على الأقل");
  const registry = getReciterRegistry();
  const reciter = registry.entries.find((r) => r.id === reciterId);
  if (!reciter) throw new Error("القارئ غير متاح في سجل القراء الموثقين");
  return {
    type: "quran-video-project",
    selections,
    reciterId,
    background: background ?? { type: "default" },
    render: { format: "mp4", syncAyah: true, syncWord: true, tajweed: true },
    rights: { audioVerified: reciter.verification?.rightsVerified === true, backgroundReviewRequired: true },
    status: "ready-for-render"
  };
}

export function validateBackground(background) {
  if (!background || typeof background !== "object") throw new TypeError("خلفية الفيديو غير صحيحة");
  const allowed = ["default", "ai-image", "ai-animation", "ai-video", "mushaf-margin", "nature", "scientific"];
  if (!allowed.includes(background.type)) throw new RangeError("نوع الخلفية غير مدعوم");
  if (background.type.startsWith("ai-") && !background.prompt) throw new Error("يجب وصف الخلفية المطلوبة");
  if (background.type === "scientific" && background.sourceUrl == null) throw new Error("الخلفية العلمية تحتاج مصدرًا");
  return true;
}
