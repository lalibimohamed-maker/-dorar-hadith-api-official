export const DEFAULT_LOCALE = "ar";

export const LOCALES = Object.freeze([
  { code: "ar", name: "العربية", nativeName: "العربية", dir: "rtl" },
  { code: "en", name: "English", nativeName: "English", dir: "ltr" },
  { code: "zh", name: "Chinese", nativeName: "中文", dir: "ltr" },
  { code: "ko", name: "Korean", nativeName: "한국어", dir: "ltr" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", dir: "ltr" },
  { code: "pl", name: "Polish", nativeName: "Polski", dir: "ltr" },
  { code: "fr", name: "French", nativeName: "Français", dir: "ltr" },
  { code: "es", name: "Spanish", nativeName: "Español", dir: "ltr" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", dir: "ltr" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", dir: "ltr" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu", dir: "ltr" },
  { code: "ur", name: "Urdu", nativeName: "اردو", dir: "rtl" },
  { code: "fa", name: "Persian", nativeName: "فارسی", dir: "rtl" }
]);

const byCode = new Map(LOCALES.map((locale) => [locale.code, locale]));

export function getLocale(code) {
  return byCode.get(String(code || "").toLowerCase()) || byCode.get(DEFAULT_LOCALE);
}

export function listLocales() {
  return LOCALES.map((locale) => ({ ...locale }));
}

export function localeFromRequest(value) {
  const requested = String(value || "").split(",")[0].trim().toLowerCase();
  return getLocale(requested);
}
