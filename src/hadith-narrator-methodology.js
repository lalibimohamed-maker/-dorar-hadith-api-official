import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, "..", "config", "hadith-narrator-methodology-2026.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

export function getHadithMethodology() {
  return config;
}

export function listNarratorGrades() {
  return config.narratorGrades || [];
}

export function listChainPhenomena() {
  return config.chainPhenomena || [];
}

export function listCoreRijalBooks() {
  return config.coreBooks || [];
}

export function findNarratorGrade(id) {
  return (config.narratorGrades || []).find((item) => item.id === id) || null;
}

export function buildNarratorResearchProfile({ name, normalizedName = null, aliases = [], teachers = [], students = [], narrations = [], judgments = [], routes = [] } = {}) {
  const judgmentsByType = judgments.map((item) => ({
    ...item,
    critic: item.critic || null,
    source: item.source || null,
    wording: item.wording || null,
    grade: item.grade || null,
    evidenceLevel: item.evidenceLevel || "needs-verification",
  }));

  return {
    name: name || null,
    normalizedName: normalizedName || name || null,
    aliases,
    network: { teachers, students },
    narrations,
    routes,
    judgments: judgmentsByType,
    disputed: judgmentsByType.filter((item) => item.disputed === true),
    methodology: {
      distinguishNarratorFromHadith: true,
      preserveCritics: true,
      requireAttribution: true,
      note: "هذا الملف إطار بحثي؛ لا يُصدر حكمًا آليًا على راوٍ أو حديث من دون بيانات موثقة من المصادر.",
    },
  };
}

export function compareNarratorJudgments(judgments = []) {
  const accepted = [];
  const rejected = [];
  const disputed = [];
  for (const item of judgments) {
    const cls = findNarratorGrade(item.grade)?.class;
    if (item.disputed || cls === "disputed") disputed.push(item);
    else if (["rejected"].includes(cls)) rejected.push(item);
    else if (["accepted", "accepted-with-caveat"].includes(cls)) accepted.push(item);
  }
  return { accepted, rejected, disputed };
}
