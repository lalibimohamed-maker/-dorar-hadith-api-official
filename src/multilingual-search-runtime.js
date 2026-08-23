const SCRIPT_LANGUAGE_HINTS = [
  { re: /[\u0E00-\u0E7F]/u, language: 'th' },
  { re: /[\u0D00-\u0D7F]/u, language: 'ml' },
  { re: /[\u0A80-\u0AFF]/u, language: 'gu' },
  { re: /[\u0900-\u097F]/u, language: 'hi' },
  { re: /[\u3040-\u30FF]/u, language: 'ja' },
  { re: /[\uAC00-\uD7AF]/u, language: 'ko' },
  { re: /[\u4E00-\u9FFF]/u, language: 'zh' },
  { re: /[\u0400-\u04FF]/u, language: 'ru' },
  { re: /[\u0600-\u06FF]/u, language: 'ar' },
  { re: /[\u0590-\u05FF]/u, language: 'he' },
];

const RTL_LANGUAGES = new Set(['ar', 'fa', 'ur', 'he', 'ps', 'dv', 'ku']);

export function normalizeLanguageTag(tag) {
  if (!tag || typeof tag !== 'string') return null;
  const value = tag.trim().replace(/_/g, '-');
  if (!value) return null;
  const [language, ...rest] = value.split('-');
  return [language.toLowerCase(), ...rest.map((part) => part.length === 2 ? part.toUpperCase() : part)].join('-');
}

export function detectLanguageHint(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  for (const hint of SCRIPT_LANGUAGE_HINTS) {
    if (hint.re.test(text)) return hint.language;
  }
  return null;
}

export function resolveResponseLanguage({ query, requestedLanguage, uiLanguage, fallback = 'ar' } = {}) {
  return normalizeLanguageTag(requestedLanguage)
    || detectLanguageHint(query)
    || normalizeLanguageTag(uiLanguage)
    || normalizeLanguageTag(fallback)
    || 'ar';
}

export function textDirection(languageTag) {
  const language = normalizeLanguageTag(languageTag)?.split('-')[0];
  return RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr';
}

export function buildCrossLanguageQuery({ query, responseLanguage, aliases = [] } = {}) {
  const cleanQuery = typeof query === 'string' ? query.trim() : '';
  const uniqueAliases = [...new Set((Array.isArray(aliases) ? aliases : [])
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim()))];

  return {
    originalQuery: cleanQuery,
    responseLanguage: normalizeLanguageTag(responseLanguage) || resolveResponseLanguage({ query: cleanQuery }),
    aliases: uniqueAliases,
    searchStrategy: uniqueAliases.length ? 'cross-language-entity-expansion' : 'source-language-aware',
    preserveOriginalText: true,
  };
}

export function classifyTranslation({ sourceLanguage, targetLanguage, source } = {}) {
  const sourceLang = normalizeLanguageTag(sourceLanguage);
  const targetLang = normalizeLanguageTag(targetLanguage);
  if (!sourceLang || !targetLang || sourceLang === targetLang) return 'original';
  return source?.verified === true ? 'verified-translation' : 'machine-or-unverified-translation';
}
