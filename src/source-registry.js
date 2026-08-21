import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const registryPath = path.join(__dirname, "..", "config", "source-registry.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

export function getRegistry() {
  return registry;
}

export function listSources({ category, role } = {}) {
  return registry.sources.filter((source) =>
    (!category || source.category === category) && (!role || source.role === role)
  );
}

export function getSource(id) {
  return registry.sources.find((source) => source.id === id) || null;
}

export function listCategories() {
  return registry.categories;
}

export function getMaqasid() {
  return registry.maqasid;
}
