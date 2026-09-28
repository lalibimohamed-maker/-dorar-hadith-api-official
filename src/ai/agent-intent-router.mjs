export const AGENT_INTENTS = Object.freeze([
  'hadith', 'quran', 'fiqh', 'rijal', 'scholar', 'general'
]);

const PATTERNS = Object.freeze({
  hadith: [
    /\bحديث\b|\bأحاديث\b|\bرواية\b|\bروايات\b|\bإسناد\b|\bسند\b|\bمتن\b/,
    /صحيح\s*(البخاري|مسلم)|سنن\s*(أبي داود|الترمذي|النسائي|ابن ماجه)/
  ],
  quran: [/\bالقرآن\b|\bقرآن\b|\bآية\b|\bآيات\b|\bسورة\b|\bسور\b|\bتفسير\b|\bتجويد\b|\bمكي|مدني/],
  fiqh: [
    /\bفقه\b|\bحكم\b|\bحلال\b|\bحرام\b|\bواجب\b|\bسنة\b|\bمكروه\b|\bمباح\b/,
    /صلاة|زكاة|صيام|حج|بيوع|نكاح|طلاق|ميراث|وصية|ربا/
  ],
  rijal: [/\bراوٍ\b|\bراوي\b|\bرواة\b|\bرجال\b|\bجرح\b|\bتعديل\b|\bثقة\b|\bضعيف\b|\bمتروك\b|\bمجهول\b/],
  scholar: [/\bشيخ\b|\bعالم\b|\bإمام\b|\bفقيه\b|\bمحدث\b|\bقول\b|\bأقوال\b|\bفتوى\b|ابن\s+(تيمية|القيم|باز|عثيمين)/]
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
