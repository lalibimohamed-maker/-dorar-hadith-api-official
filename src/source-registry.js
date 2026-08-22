import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configDir = path.join(__dirname, "..", "config");
const registry = JSON.parse(fs.readFileSync(path.join(configDir, "source-registry.json"), "utf8"));

function readJson(name, fallback) {
  const file = path.join(configDir, name);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
}

const fatwaExpansion = readJson("fatwa-source-expansion-2026.json", { sources: [], taxonomy: [] });
const contemporaryScholars = readJson("contemporary-sunni-scholars.json", { scholars: [] });

const fatwaSources = (fatwaExpansion.sources || []).map((source) => ({
  ...source,
  category: "fatwa",
  role: source.type === "official-scholar-site" || source.type === "official-foundation-site" ? "official-fatwa-source" : "fatwa-source",
  sourceKind: source.type || "fatwa-source",
  reusePolicy: source.reuse || "source-permission-dependent",
}));

const scholarSources = (contemporaryScholars.scholars || []).flatMap((scholar) =>
  (scholar.sources || []).map((source) => ({
    id: `scholar-${scholar.id}`,
    nameAr: source.nameAr || scholar.nameAr,
    scholar: scholar.nameAr,
    category: "fatwa",
    url: source.url,
    role: "official-fatwa-source",
    sourceKind: source.type || "scholar-source",
    contentTypes: scholar.contentTypes || [],
    attributionRequired: true,
    noEndorsementByInclusion: true,
  }))
);

const categories = [
  ...registry.categories,
  { id: "fatwa", nameAr: "الفتاوى ومصادر العلماء" },
];

const sourceIds = new Set(registry.sources.map((source) => source.id));
const mergedSources = [
  ...registry.sources,
  ...fatwaSources.filter((source) => !sourceIds.has(source.id)),
  ...scholarSources.filter((source) => !sourceIds.has(source.id)),
];

const mergedRegistry = {
  ...registry,
  categories,
  sources: mergedSources,
  fatwa: {
    taxonomy: fatwaExpansion.taxonomy || [],
    sourceCount: mergedSources.filter((source) => source.category === "fatwa").length,
    scholarCount: new Set(scholarSources.map((source) => source.scholar).filter(Boolean)).size,
    policy: fatwaExpansion.policy || null,
  },
};

export function getRegistry() {
  return mergedRegistry;
}

export function listSources({ category, role } = {}) {
  return mergedRegistry.sources.filter((source) =>
    (!category || source.category === category) && (!role || source.role === role)
  );
}

export function getSource(id) {
  return mergedRegistry.sources.find((source) => source.id === id) || null;
}

export function listCategories() {
  return mergedRegistry.categories;
}

export function getMaqasid() {
  return mergedRegistry.maqasid;
}
