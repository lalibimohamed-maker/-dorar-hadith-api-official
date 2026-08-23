export function createScientificSignsProject({ topic, ayahs, primaryLanguage, additionalLanguages = [], scientificSources = [], religiousSources = [] }) {
  if (!topic) throw new TypeError("الموضوع مطلوب");
  if (!Array.isArray(ayahs) || ayahs.length === 0) throw new TypeError("يجب اختيار آيات موثقة");
  if (additionalLanguages.length > 2) throw new RangeError("اللغات الإضافية في فيديو الإعجاز لا تتجاوز لغتين");
  if (!Array.isArray(scientificSources) || !Array.isArray(religiousSources)) throw new TypeError("المصادر غير صحيحة");
  return {
    type: "quran-scientific-signs-project",
    topic,
    ayahs,
    languages: { primary: primaryLanguage, additional: additionalLanguages },
    evidence: { scientific: scientificSources, religious: religiousSources },
    policy: { noForcedConcordism: true, hypothesisMustBeLabeled: true, uncertaintyMustBeShown: true, tafsirSeparatedFromModernScience: true },
    video: { arabicAyah: true, meaningTranslation: true, citations: true, endCard: true, format: "mp4" },
    status: "ready-for-source-review"
  };
}
