import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const map = JSON.parse(fs.readFileSync(path.join(root, "..", "config", "corpus-source-map-2026.json"), "utf8"));

export function getCorpusSourceMap() {
  return structuredClone(map);
}

export function findDomainsForSource(sourceId) {
  const id = String(sourceId || "").trim();
  return Object.entries(map.domains).filter(([, sources]) => sources.includes(id)).map(([domain]) => domain);
}

export function findSourcesForDomain(domain) {
  return [...(map.domains[String(domain || "").trim()] || [])];
}
