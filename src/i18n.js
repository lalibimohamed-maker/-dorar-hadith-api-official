export const DEFAULT_LOCALE = "ar";

// Exactly 20 launch locales. Religious source texts remain in their original form;
// translations must always carry their own source attribution.
export const LOCALES = Object.freeze([
  { code: "ar", name: "Arabic", nativeName: "العربية", dir: "rtl" },
  { code: "en", name: "English", nativeName: "English", dir: "ltr" },
  { code: "zh", name: "Chinese", nativeName: "中文", dir: "ltr" },
  { code: "ko", name: "Korean", nativeName: "한국어", dir: "ltr" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", dir: "ltr" },
  { code: "pl", name: "Polish", nativeName: "Polski", dir: "ltr" },
  { code: "fr", name: "French", nativeName: "Français", dir: "ltr" },
  { code: "es", name: "Spanish", nativeName: "Español", dir: "ltr" },
  { code: "it", name: "Italian", nativeName: "Italiano", dir: "ltr" },
  { code: "de", name: "German", nativeName: "Deutsch", dir: "ltr" },
  { code: "ru", name: "Russian", nativeName: "Русский", dir: "ltr" },
  { code: "ja", name: "Japanese", nativeName: "日本語", dir: "ltr" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", dir: "ltr" },
  { code: "fi", name: "Finnish", nativeName: "Suomi", dir: "ltr" },
  { code: "ber", name: "Tamazight", nativeName: "ⵜⴰⵎⴰⵣⵉⵖⵜ", dir: "ltr" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", dir: "ltr" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", dir: "ltr" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu", dir: "ltr" },
  { code: "ur", name: "Urdu", nativeName: "اردو", dir: "rtl" },
  { code: "fa", name: "Persian", nativeName: "فارسی", dir: "rtl" }
]);

const byCode = new Map(LOCALES.map((locale) => [locale.code, locale]));

const LANGUAGE_HINTS = Object.freeze({
  ar: ["ما", "من", "في", "عن", "هل", "ما هي", "ما هو", "السيرة", "الفقه", "العقيدة", "الإسلام"],
  en: ["what", "which", "how", "is", "are", "the", "about", "islam", "hadith", "fiqh"],
  fr: ["quel", "quelle", "quels", "quelles", "comment", "dans", "les", "est", "sont", "islam"],
  es: ["qué", "cual", "cuál", "cómo", "los", "las", "es", "son", "islam"],
  it: ["che", "quale", "quali", "come", "gli", "le", "è", "sono", "islam"],
  de: ["was", "welche", "welcher", "wie", "die", "der", "das", "ist", "sind", "islam"],
  ru: ["что", "какие", "какой", "как", "это", "есть", "ислам", "хадис"],
  ja: ["何", "なに", "どの", "どんな", "とは", "です", "イスラム", "ハディース"],
  hi: ["क्या", "कौन", "कैसे", "है", "हैं", "इस्लाम", "हदीस"],
  fi: ["mikä", "mitkä", "miten", "onko", "ovatko", "islam", "hadith"],
  tr: ["nedir", "hangi", "hangisi", "nasıl", "olan", "islam", "hadis"],
  id: ["apa", "yang", "mana", "bagaimana", "adalah", "islam", "hadis"],
  ms: ["apa", "yang", "mana", "bagaimana", "ialah", "islam", "hadis"],
  ur: ["کیا", "کون", "کون سے", "کیسے", "ہے", "ہیں", "اسلام", "حدیث"],
  fa: ["چیست", "کدام", "چگونه", "است", "هست", "اسلام", "حدیث"],
  zh: ["什么", "哪些", "如何", "是", "伊斯兰", "圣训"],
  ko: ["무엇", "어떤", "어떻게", "입니다", "이슬람", "하디스"],
  bn: ["কি", "কোন", "কীভাবে", "হয়", "ইসলাম", "হাদিস"],
  pl: ["co", "które", "jak", "jest", "są", "islam", "hadis"],
  ber: ["acu", "acu-t", "anwa", "amek", "tmazight", "islam"]
});

export function getLocale(code) {
  return byCode.get(String(code || "").toLowerCase()) || byCode.get(DEFAULT_LOCALE);
}

export function listLocales() {
  return LOCALES.map((locale) => ({ ...locale }));
}

export function detectLocale(text) {
  const value = String(text || "").trim().toLowerCase();
  if (!value) return null;
  if (/[\u4e00-\u9fff]/u.test(value)) return getLocale("zh");
  if (/[\u3040-\u30ff]/u.test(value)) return getLocale("ja");
  if (/[\uac00-\ud7af]/u.test(value)) return getLocale("ko");
  if (/[\u0400-\u04ff]/u.test(value)) return getLocale("ru");
  if (/[\u0900-\u097f]/u.test(value)) return getLocale("hi");
  if (/[\u0980-\u09ff]/u.test(value)) return getLocale("bn");
  if (/[\u0600-\u06ff]/u.test(value)) return getLocale("ar");
  const scores = new Map();
  for (const [code, hints] of Object.entries(LANGUAGE_HINTS)) {
    const score = hints.reduce((n, hint) => n + (value.includes(hint) ? 1 : 0), 0);
    if (score) scores.set(code, score);
  }
  if (!scores.size) return null;
  const [bestCode, bestScore] = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];
  const second = [...scores.values()].sort((a, b) => b - a)[1] || 0;
  return bestScore >= 2 || bestScore > second ? getLocale(bestCode) : null;
}

// Query language has priority over settings/device language. The request value is
// used only when the query is empty or its language cannot be detected.
export function localeFromRequest(value, queryText = "") {
  const requested = String(value || "").split(",")[0].trim().toLowerCase();
  return detectLocale(queryText) || getLocale(requested) || getLocale(DEFAULT_LOCALE);
}
