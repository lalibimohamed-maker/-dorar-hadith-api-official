import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.join(__dirname, "..", "config", "interactive-learning-2026.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

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

const aliases = new Map([
  ["wudu", ["وضوء", "وضو", "طهارة"]],
  ["major-ghusl", ["غسل", "غسل اكبر", "جنابة"]],
  ["tayammum", ["تيمم"]],
  ["prophetic-prayer", ["صلاة", "اصلي", "كيف اصلي", "صفة صلاة النبي"]],
  ["sujud-sahw", ["سجود السهو", "نسي في الصلاة"]],
  ["sujud-tilawah", ["سجود التلاوة", "سجدة التلاوة"]],
  ["sujud-shukr", ["سجود الشكر"]],
  ["adhan", ["اذان", "الأذان"]],
  ["iqamah", ["اقامة", "الإقامة"]],
  ["funeral-prayer", ["صلاة الجنازة", "صلاة الميت", "كيف اصلي على الميت"]],
  ["istisqa", ["استسقاء", "صلاة الاستسقاء"]],
  ["fasting", ["صيام", "صوم", "رمضان"]],
  ["zakat", ["زكاة", "اخراج الزكاة", "نصاب", "حول"]],
  ["zakat-fitr", ["زكاة الفطر", "فطرة"]],
  ["hajj", ["حج", "الحج"]],
  ["umrah", ["عمرة", "العمرة"]],
  ["ruqyah", ["رقية", "الرقية الشرعية"]]
]);

export function getInteractiveLearningCatalog() {
  return catalog;
}

export function getWorshipModule(id) {
  return catalog.worship.find((item) => item.id === id) || null;
}

export function listWorshipModules() {
  return catalog.worship.map(({ id, nameAr }) => ({ id, nameAr }));
}

export function resolveLearningIntent(question) {
  const q = normalize(question);
  const matches = [];
  for (const item of catalog.worship) {
    const terms = aliases.get(item.id) || [item.nameAr];
    const score = terms.reduce((sum, term) => {
      const t = normalize(term);
      return q.includes(t) ? sum + (t.includes(" ") ? 20 : 10) : sum;
    }, 0);
    if (score > 0) matches.push({ id: item.id, nameAr: item.nameAr, score });
  }
  matches.sort((a, b) => b.score - a.score);
  return matches[0] || null;
}

export function buildLearningLesson(id, { language = "ar" } = {}) {
  const module = getWorshipModule(id);
  if (!module) return null;
  return {
    engineId: "worship-teaching",
    moduleId: module.id,
    title: module.nameAr,
    language,
    quranEvidence: module.quran,
    hadithSources: module.hadithSources,
    scholars: module.scholars || [],
    steps: module.steps.map((title, index) => ({
      order: index + 1,
      title,
      evidenceStatus: module.evidenceStatus,
      requiresVerification: module.evidenceStatus !== "primary_sources_required_per_step"
    })),
    policy: catalog.policy
  };
}

export function calculateQiblaBearing(latitude, longitude) {
  const kaaba = catalog.islamicTools.qibla.kaabaCoordinates;
  const toRad = (deg) => deg * Math.PI / 180;
  const toDeg = (rad) => rad * 180 / Math.PI;
  const phi1 = toRad(latitude);
  const phi2 = toRad(kaaba.latitude);
  const deltaLambda = toRad(kaaba.longitude - longitude);
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function calculateZakat2Point5({ base = 0, nisab = 0, eligible = true } = {}) {
  const amount = Math.max(Number(base) || 0, 0);
  const threshold = Math.max(Number(nisab) || 0, 0);
  const due = eligible && threshold > 0 && amount >= threshold ? amount * 0.025 : 0;
  return { base: amount, nisab: threshold, eligible, rate: 0.025, due };
}
