import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(root, "..", "config", "quran-scientific-signs-2026.json"), "utf8"));

export function getScientificSignsConfig() { return config; }

export function validateScientificVideoLanguages(primaryLanguage, additionalLanguages = []) {
  if (!primaryLanguage || typeof primaryLanguage !== "string") throw new TypeError("اللغة الأساسية مطلوبة");
  if (!Array.isArray(additionalLanguages)) throw new TypeError("اللغات الإضافية يجب أن تكون قائمة");
  if (additionalLanguages.length > config.languages.additionalLanguages) throw new RangeError("اللغات الإضافية في فيديو الإعجاز لا تتجاوز لغتين");
  if (additionalLanguages.some((language) => typeof language !== "string" || !language.trim())) throw new TypeError("لغة إضافية غير صحيحة");
  const uniqueAdditional = [...new Set(additionalLanguages)];
  if (uniqueAdditional.length !== additionalLanguages.length) throw new RangeError("لا يمكن تكرار اللغة الإضافية");
  if (uniqueAdditional.includes(primaryLanguage)) throw new RangeError("اللغة الأساسية لا تُكرر ضمن اللغات الإضافية");
  return { primaryLanguage, additionalLanguages: uniqueAdditional, meaningTranslation: true };
}

export function createScientificSignsProject({ topic, ayahs, primaryLanguage, additionalLanguages = [], scientificSources = [], religiousSources = [] }) {
  if (!topic) throw new TypeError("الموضوع مطلوب");
  if (!Array.isArray(ayahs) || ayahs.length === 0) throw new TypeError("يجب اختيار آيات موثقة");
  const languages = validateScientificVideoLanguages(primaryLanguage, additionalLanguages);
  if (!Array.isArray(scientificSources) || !Array.isArray(religiousSources)) throw new TypeError("المصادر غير صحيحة");
  return { type: "quran-scientific-signs-project", topic, ayahs, languages, evidence: { scientific: scientificSources, religious: religiousSources }, policy: config.claimPolicy, video: { arabicAyah: true, meaningTranslation: true, citations: true, endCard: true, format: "mp4" }, status: "ready-for-source-review" };
}

export function classifyScientificClaim({ status, tafsirSupport = false }) {
  const allowed = new Set(["established", "strong_correspondence", "possible", "hypothesis"]);
  if (!allowed.has(status)) throw new RangeError("حالة الدليل العلمي غير معروفة");
  if (status === "hypothesis") return "speculative_do_not_present_as_fact";
  if (status === "established" && !tafsirSupport) return "scientific_observation_with_separate_tafsir";
  return status;
}
