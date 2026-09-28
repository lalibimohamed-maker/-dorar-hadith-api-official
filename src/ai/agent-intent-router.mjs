export const AGENT_INTENTS = Object.freeze([
  'hadith', 'quran', 'fiqh', 'rijal', 'scholar', 'general'
]);

const PATTERNS = Object.freeze({
  hadith: [
    /حديث|أحاديث|رواية|روايات|إسناد|سند|متن|hadith|narration|isnad|chain|matn/i,
    /صحيح\s*(البخاري|مسلم)|سنن\s*(أبي داود|الترمذي|النسائي|ابن ماجه)|sahih\s*(bukhari|muslim)/i
  ],
  quran: [
    /القرآن|قرآن|آية|آيات|سورة|سور|تفسير|تجويد|مكي|مدني|quran|ayah|surah|tafsir|tajweed/i
  ],
  fiqh: [
    /فقه|حكم|حلال|حرام|واجب|سنة|مكروه|مباح|fiqh|ruling|halal|haram|fard|sunnah/i,
    /صلاة|زكاة|صيام|حج|بيوع|نكاح|طلاق|ميراث|وصية|ربا|prayer|zakat|fasting|hajj|marriage|divorce|inheritance|riba/i
  ],
  rijal: [
    /راوٍ|راوي|رواة|رجال|جرح|تعديل|ثقة|ضعيف|متروك|مجهول|narrator|rijal|jarh|ta'dil|trustworthy|weak/i
  ],
  scholar: [
    /شيخ|عالم|إمام|فقيه|محدث|قول|أقوال|فتوى|scholar|imam|jurist|muhaddith|opinion|fatwa/i
  ]
});

function normalizeQuery(query) {
  return String(query || '').normalize('NFKC').replace(/[ًٌٍَُِّْـ]/g, '').trim();
}

export function routeIntent(query) {
  const normalized = normalizeQuery(query);
  if (!normalized) return Object.freeze({ intent: 'general', confidence: 0, matchedSignals: [] });
  const scores = AGENT_INTENTS.filter(intent => intent !== 'general').map(intent => {
    const matchedSignals = PATTERNS[intent].filter(pattern => pattern.test(normalized)).map(pattern => pattern.source);
    return { intent, score: matchedSignals.length, matchedSignals };
  }).sort((a, b) => b.score - a.score);
  const top = scores[0];
  if (!top || top.score === 0) return Object.freeze({ intent: 'general', confidence: 0, matchedSignals: [] });
  return Object.freeze({ intent: top.intent, confidence: Math.min(0.99, 0.55 + top.score * 0.18), matchedSignals: top.matchedSignals });
}
