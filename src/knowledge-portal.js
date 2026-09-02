import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const configPath = path.join(root, "config/portal-of-knowledge-2026.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getKnowledgePortal() {
  const portal = deepClone(config);
  portal.generatedAt = new Date().toISOString();
  return portal;
}

export function getKnowledgeCapability(id) {
  const key = String(id || "").trim();
  if (!key) return null;
  const capabilities = config.capabilities || {};
  for (const [domain, value] of Object.entries(capabilities)) {
    if (domain === key) return { id: domain, domain, ...deepClone(value) };
    if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, key)) {
      return { id: `${domain}.${key}`, domain, capability: key, value: deepClone(value[key]) };
    }
  }
  return null;
}

export function listKnowledgeCapabilities() {
  return Object.entries(config.capabilities || {}).map(([id, value]) => ({
    id,
    title: id,
    keys: Object.keys(value || {})
  }));
}

export function portalSourcePolicy() {
  return deepClone({
    principles: config.principles,
    provenance: config.capabilities?.provenance,
    externalResearchBasis: config.externalResearchBasis
  });
}
