import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "config", "specialized-engines-2026.json"), "utf8"));

const aliases = {
  "sermons-lessons": ["محاضرة", "درس", "خطبة", "خطبة الجمعة", "خطبة العيد", "الزواج", "عقد القران", "رمضان", "موعظة"],
  "prophetic-medicine": ["الطب النبوي", "علاج", "عشبة", "أعشاب", "دواء", "الحبة السوداء", "العسل", "الحجامة"],
  "dua-adhkar": ["دعاء", "أدعية", "ذكر", "أذكار", "حصن المسلم", "ورد", "دعاء الشفاء", "دعاء الرزق", "قيام الليل", "ختم القرآن"],
  "worship-teaching": ["الصلاة", "وضوء", "طهارة", "غسل", "تيمم", "سجود السهو", "سجود التلاوة", "سجود الشكر", "صلاة الاستسقاء", "صلاة الميت", "صلاة الجنازة", "صفة صلاة النبي", "الأذان", "الإقامة", "الصيام", "زكاة", "زكاة الفطر", "الحج", "العمرة", "الرقية"],
  "quran-learning": ["قرآن", "تجويد", "تلاوة", "مصحف", "قارئ", "رواية ورش", "تحفيظ", "حفظ القرآن"],
  "islamic-tools": ["مواقيت الصلاة", "وقت الصلاة", "القبلة", "اتجاه القبلة", "الأذان", "التقويم الهجري", "حساب الزكاة", "المواريث"]
};

const priorityRules = [
  { engineId: "worship-teaching", patterns: [
    ["صلاة", "الجنازة"], ["صلاة", "الميت"], ["كيف", "اصلي", "الجنازة"], ["كيف", "اصلي", "الميت"],
    ["صفة", "صلاة", "النبي"], ["سجود", "السهو"], ["سجود", "التلاوة"], ["كيف", "اتوضأ"],
    ["كيف", "اصلي"], ["زكاة", "الفطر"]
  ]},
  { engineId: "quran-learning", patterns: [["تعلم", "التجويد"], ["تعلم", "القرآن"], ["رواية", "ورش"], ["كيف", "اقرا", "القرآن"]]},
  { engineId: "islamic-tools", patterns: [["مواقيت", "الصلاة"], ["اتجاه", "القبلة"], ["حساب", "الزكاة"], ["التقويم", "الهجري"]]},
  { engineId: "sermons-lessons", patterns: [["موعظة", "جنازة"], ["خطبة", "جنازة"], ["درس", "جنازة"]]}
];

function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase("ar")
    .normalize("NFKC")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreTerms(q, terms) {
  return terms.reduce((score, term) => {
    const normalized = normalize(term);
    if (!normalized || !q.includes(normalized)) return score;
    return score + (normalized.split(" ").length > 1 ? 20 : 10);
  }, 0);
}

function matchesPriorityRule(q, rule) {
  return rule.patterns.some((pattern) => pattern.every((term) => q.includes(normalize(term))));
}

export function getSpecializedEngines() {
  return config.engines;
}

export function routeSpecializedQuestion(question) {
  const q = normalize(question);
  const priority = priorityRules.find((rule) => matchesPriorityRule(q, rule));
  const scores = config.engines
    .map((engine) => ({ engine, score: scoreTerms(q, aliases[engine.id] || [engine.nameAr]) }))
    .sort((a, b) => b.score - a.score);

  const best = priority ? scores.find((item) => item.engine.id === priority.engineId) : scores[0];
  const fallback = config.engines.find((engine) => engine.id === "source-to-answer");
  const source = best && (best.score > 0 || priority) ? best.engine : fallback;
  const winning = priority ? Math.max(best?.score || 0, 100) : (best?.score || 0);

  return {
    engineId: source?.id || "source-to-answer",
    confidence: winning > 0 ? Math.min(winning / 100, 1) : 0.1,
    candidates: scores.filter((item) => item.score > 0).map((item) => ({ id: item.engine.id, score: item.score })),
    sourceOrder: source?.sourceOrder || null,
    languagePolicy: fallback?.languagePolicy || null
  };
}

export function getEngine(id) {
  return config.engines.find((engine) => engine.id === id) || null;
}
