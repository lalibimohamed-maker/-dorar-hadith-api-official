import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "config", "specialized-engines-2026.json"), "utf8"));

const aliases = {
  "sermons-lessons": ["محاضرة", "درس", "خطبة", "خطبة الجمعة", "خطبة العيد", "الزواج", "عقد القران", "رمضان", "موعظة", "جنازة"],
  "prophetic-medicine": ["الطب النبوي", "علاج", "عشبة", "أعشاب", "دواء", "الحبة السوداء", "العسل", "الحجامة"],
  "dua-adhkar": ["دعاء", "أدعية", "ذكر", "أذكار", "حصن المسلم", "ورد", "دعاء الشفاء", "دعاء الرزق", "قيام الليل", "ختم القرآن"],
  "worship-teaching": ["الصلاة", "الوضوء", "الطهارة", "الغسل", "التيمم", "سجود السهو", "سجود التلاوة", "صلاة الاستسقاء", "صلاة الميت", "صفة صلاة النبي"]
};

function normalize(value) {
  return String(value || "").toLocaleLowerCase("ar").replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/\s+/g, " ").trim();
}

export function getSpecializedEngines() {
  return config.engines;
}

export function routeSpecializedQuestion(question) {
  const q = normalize(question);
  const scores = config.engines.map((engine) => {
    const terms = aliases[engine.id] || [engine.nameAr];
    const score = terms.reduce((total, term) => total + (q.includes(normalize(term)) ? 10 : 0), 0);
    return { engine, score };
  }).sort((a, b) => b.score - a.score);

  const best = scores[0];
  return {
    engineId: best && best.score > 0 ? best.engine.id : "source-to-answer",
    confidence: best && best.score > 0 ? Math.min(best.score / 20, 1) : 0.1,
    candidates: scores.filter((item) => item.score > 0).map((item) => ({ id: item.engine.id, score: item.score })),
    sourceOrder: (best && best.score > 0 ? best.engine : config.engines.find((item) => item.id === "source-to-answer")).sourceOrder || null,
    languagePolicy: config.engines.find((item) => item.id === "source-to-answer").languagePolicy
  };
}

export function getEngine(id) {
  return config.engines.find((engine) => engine.id === id) || null;
}
