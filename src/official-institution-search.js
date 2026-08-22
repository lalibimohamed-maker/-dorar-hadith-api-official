import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "config", "official-institution-sources.json");

function loadRegistry() {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function normalize(value) {
  return String(value || "").trim().toLocaleLowerCase("ar");
}

export function searchOfficialInstitutions(query, { country = null, capability = null } = {}) {
  const registry = loadRegistry();
  const q = normalize(query);
  return registry.sources
    .filter((source) => !country || source.country === country)
    .filter((source) => !capability || source.capabilities.includes(capability))
    .filter((source) => !q || [source.nameAr, source.country, ...(source.capabilities || [])].some((v) => normalize(v).includes(q)))
    .map((source) => ({
      id: source.id,
      title: source.nameAr,
      source: source.url,
      country: source.country,
      institutionType: source.institutionType,
      capabilities: source.capabilities,
      sourceLayer: "islamic-official-institution-secondary",
      verification: "official-institution-reference",
      corpus: "sunni",
      rights: "source-dependent",
    }));
}

export function officialInstitutionPolicy() {
  return loadRegistry().policy;
}
