import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getRegistry, listCategories, listSources } from "./source-registry.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const coverage = JSON.parse(fs.readFileSync(path.join(root, "..", "config", "source-coverage-2026.json"), "utf8"));

export function getSourceCoverageReport() {
  const registry = getRegistry();
  const categories = listCategories();
  const sources = listSources();
  const presentCategories = new Set(categories.map((category) => category.id));
  const missingCategories = coverage.requiredCategories.filter((id) => !presentCategories.has(id));
  const policyChecks = coverage.requiredPolicies.map((policy) => ({
    policy,
    present: sources.length > 0 && sources.every((source) => source[policy] === true || policy === "sourceVerificationBeforePromotion")
  }));

  return {
    version: coverage.version,
    categoryCount: categories.length,
    sourceCount: sources.length,
    bookCount: registry.books?.length ?? 0,
    missingCategories,
    policyChecks,
    healthy: missingCategories.length === 0 && sources.length > 0
  };
}

export function assertSourceCoverage() {
  const report = getSourceCoverageReport();
  if (!report.healthy) {
    throw new Error(`Source coverage incomplete: missing categories=${report.missingCategories.join(",")}`);
  }
  return report;
}
