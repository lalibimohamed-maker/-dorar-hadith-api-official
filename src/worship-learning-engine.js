import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(root, "..", "config", "worship-learning-2026.json"), "utf8"));

const TOPIC_ALIASES = {
  wudu: ["وضوء", "وضوئي", "الوضوء"],
  majorGhusl: ["الغسل الأكبر", "غسل الجنابة", "غسل", "الاغتسال"],
  tayammum: ["التيمم", "تيمم"],
  prayer: ["الصلاة", "صلاة", "كيف أصلي", "صفة الصلاة", "صفة صلاة النبي"],
  khushu: ["الخشوع", "خشوع الصلاة"],
  adhan: ["الأذان", "اذان", "المؤذن"],
  iqamah: ["الإقامة", "اقامة"],
  janazah: ["صلاة الجنازة", "صلاة الميت", "غسل الميت"],
  zakat: ["الزكاة", "زكاة", "نصاب", "الحول", "زكاة الفطر", "احسب الزكاة"],
  fasting: ["الصيام", "الصوم", "مفطرات", "القضاء", "الفدية", "الكفارة"],
  hajj: ["الحج", "العمرة", "الإحرام", "الطواف", "السعي"],
  ruqyah: ["الرقية", "الرقية الشرعية", "رقيه"]
};

function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase("ar")
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

function findTopic(question) {
  const q = normalize(question);
  let best = null;
  for (const [id, aliases] of Object.entries(TOPIC_ALIASES)) {
    for (const alias of aliases) {
      const a = normalize(alias);
      if (!a || !q.includes(a)) continue;
      const score = a.split(" ").length * 10 + a.length;
      if (!best || score > best.score) best = { id, score };
    }
  }
  return best?.id || null;
}

export function getWorshipLearningConfig() {
  return config;
}

export function detectWorshipTopic(question) {
  return findTopic(question);
}

export function createLearningSession({ topic, audience = "general", language = "ar", mode = "guided" } = {}) {
  const normalizedTopic = topic || "prayer";
  const module = config.modules.find((item) => item.id === normalizedTopic) || config.modules.find((item) => item.id === "prayer");
  return {
    engineId: config.engineId,
    topic: module.id,
    audience: config.audiences.includes(audience) ? audience : "general",
    language,
    mode: config.modes.includes(mode) ? mode : "guided",
    modules: module.topics,
    lessonModel: config.lessonModel,
    sourceOrder: config.sourceOrder
  };
}

export function buildPracticeStep({ objective, instruction, visualCue = null, audioCue = null, action = "observe", evidence = [], commonMistakes = [], practiceCheck = null, next = null } = {}) {
  if (!objective || !instruction) throw new TypeError("objective and instruction are required");
  if (!Array.isArray(evidence) || evidence.length === 0) throw new TypeError("each instructional step requires evidence");
  return { objective, instruction, visualCue, audioCue, action, evidence, commonMistakes, practiceCheck, next };
}

export function buildZakatCalculation({ assets = {}, liabilities = 0, nisab = 0, rate = 0.025, eligible = true } = {}) {
  const totalAssets = Object.values(assets).reduce((sum, value) => sum + Number(value || 0), 0);
  const netEligible = Math.max(totalAssets - Number(liabilities || 0), 0);
  return {
    eligible,
    totalAssets,
    netEligible,
    nisab,
    rate,
    due: eligible && netEligible >= nisab ? netEligible * rate : 0,
    requiresScholarlyRulesForAssets: true
  };
}

export function getCanonicalEvidenceExamples() {
  return [...config.canonicalEvidenceExamples];
}
