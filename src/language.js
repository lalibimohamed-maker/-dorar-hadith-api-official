const LANGUAGE_RULES = [
  ["ar", /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g],
  ["fa", /[\u067E\u0686\u0698\u06AF]/g],
  ["ur", /[\u0679\u0688\u0691\u06BA\u06BE\u06C1]/g],
  ["he", /[\u0590-\u05FF]/g],
  ["ru", /[\u0400-\u04FF]/g],
  ["el", /[\u0370-\u03FF]/g],
  ["hy", /[\u0530-\u058F]/g],
  ["ka", /[\u10A0-\u10FF]/g],
  ["hi", /[\u0900-\u097F]/g],
  ["bn", /[\u0980-\u09FF]/g],
  ["pa", /[\u0A00-\u0A7F]/g],
  ["gu", /[\u0A80-\u0AFF]/g],
  ["ta", /[\u0B80-\u0BFF]/g],
  ["te", /[\u0C00-\u0C7F]/g],
  ["kn", /[\u0C80-\u0CFF]/g],
  ["ml", /[\u0D00-\u0D7F]/g],
  ["th", /[\u0E00-\u0E7F]/g],
  ["lo", /[\u0E80-\u0EFF]/g],
  ["km", /[\u1780-\u17FF]/g],
  ["my", /[\u1000-\u109F]/g],
  ["ja", /[\u3040-\u30FF\u31F0-\u31FF]/g],
  ["ko", /[\uAC00-\uD7AF\u1100-\u11FF]/g],
  ["zh", /[\u3400-\u4DBF\u4E00-\u9FFF]/g]
];

const LATIN_HINTS = {
  en: /\b(the|and|is|are|what|who|how|why|hadith|prophet|allah|about)\b/i,
  fr: /\b(le|la|les|des|et|est|que|qui|comment|pourquoi|hadith|prophète)\b/i,
  es: /\b(el|la|los|las|y|es|qué|quién|cómo|por qué|hadiz|profeta)\b/i,
  de: /\b(der|die|das|und|ist|was|wer|wie|warum|hadith|prophet)\b/i,
  tr: /\b(ve|bir|bu|nedir|kim|nasıl|neden|hadis|peygamber)\b/i,
  id: /\b(dan|yang|apa|siapa|bagaimana|mengapa|hadis|nabi)\b/i,
  ms: /\b(dan|yang|apa|siapa|bagaimana|mengapa|hadis|nabi)\b/i,
  pt: /\b(o|a|os|as|e|é|que|quem|como|por que|hadith|profeta)\b/i,
  it: /\b(il|la|gli|e|è|che|chi|come|perché|hadith|profeta)\b/i,
  nl: /\b(de|het|en|is|wat|wie|hoe|waarom|hadith|profeet)\b/i
};

export function detectLanguage(text) {
  const input = String(text || "").trim();
  if (!input) return { code: "und", confidence: 0 };

  const scores = new Map();

  for (const [code, pattern] of LANGUAGE_RULES) {
    const matches = input.match(pattern);
    if (matches?.length) scores.set(code, matches.length);
  }

  for (const [code, pattern] of Object.entries(LATIN_HINTS)) {
    if (pattern.test(input)) scores.set(code, (scores.get(code) || 0) + 3);
  }

  if (!scores.size) {
    const latinLetters = (input.match(/[A-Za-z]/g) || []).length;
    return {
      code: latinLetters ? "en" : "und",
      confidence: latinLetters ? 0.35 : 0
    };
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [code, score] = ranked[0];
  const total = ranked.reduce((sum, [, value]) => sum + value, 0);

  return {
    code,
    confidence: Math.min(0.99, Number((score / Math.max(total, 1)).toFixed(2)))
  };
}

export const supportedLanguages = [
  "ar", "en", "fr", "es", "de", "tr", "id", "ms", "pt", "it", "nl",
  "fa", "ur", "he", "ru", "el", "hy", "ka", "hi", "bn", "pa", "gu",
  "ta", "te", "kn", "ml", "th", "lo", "km", "my", "ja", "ko", "zh"
];
