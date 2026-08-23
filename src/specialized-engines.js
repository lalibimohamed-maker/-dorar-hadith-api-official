import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "config", "specialized-engines-2026.json"), "utf8"));

const aliases = {
  "sermons-lessons": ["محاضرة", "درس", "خطبة", "خطبة الجمعة", "خطبة العيد", "الزواج", "عقد القران", "رمضان", "موعظة", "جنازة"],
  "prophetic-medicine": ["الطب النبوي", "علاج", "عشبة", "أعشاب", "دواء", "الحبة السوداء", "العسل", "الحجامة"],
  "dua-adhkar": ["دعاء", "أدعية", "ذكر", "أذكار", "حصن المسلم", "ورد", "دعاء الشفاء", "دعاء الرزق", "قيام الليل", "ختم القرآن"],
  "worship-teaching": ["الصلاة", "الوضوء", "الطهارة", "الغسل", "التيمم", "سجود السهو", "سجود التلاوة", "صلاة الاستسقاء", "صلاة الميت", "صلاة الجنازة", "صفة صلاة النبي"]
};

function normalize(value) {
  return String(value || "").toLocaleLowerCase("ar").replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/\s+/g, " ").trim();
}

function scoreTerms(question, terms) {
  return terms.reduce((total, term) => {
    const normalizedTerm = normalize(term);
    if (!normalizedTerm || !question.includes(normalizedTerm)) return total;
    // Prefer specific multi-word concepts over generic single-word aliases.
    const specificity = normalizedTerm.split(" ").length > 1 ? 20 : 10;
    return total + specificity;
  }, 0);
}

export function getSpecializedEngines() {
  return config.engines;
}

export function routeSpecializedQuestion(question) {
  const q = normalize(question);
  const scores = config.engines.map((engine) => {
    const terms = aliases[engine.id] || [engine.nameAr];
    const score = scoreTerms(q, terms);
    return { engine, score };
  }).sort((a, b) => b.score - a.score);

  const best = scores[0];
  return {
    engineId: best && best.score > 0 ? best.engine.id : "source-to-answer",
    confidence: best && best.score > 0 ? Math.min(best.score / 40, 1) : 0.1,
    candidates: scores.filter((item) => item.score > 0).map((item) => ({ id: item.engine.id, score: item.score })),
    sourceOrder: (best && best.score > 0 ? best.engine : config.engines.find((item) => item.id === "source-to-answer")).sourceOrder || null,
    languagePolicy: config.engines.find((item) => item.id === "source-to-answer").languagePolicy
  };
}

export function getEngine(id) {
  return config.engines.find((engine) => engine.id === id) || null;
}
