import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const registryPath = path.join(__dirname, "..", "data", "ghaib", "hadith-evidence-registry-2026.json");

function readRegistry() {
  return JSON.parse(fs.readFileSync(registryPath, "utf8"));
}

export function getHadithEvidenceRegistry() {
  return readRegistry();
}

export function searchHadithEvidence(domain, subtopic) {
  const registry = readRegistry();
  return registry.records.filter((record) => {
    if (domain && record.domain !== domain) return false;
    if (subtopic && record.subtopic !== subtopic) return false;
    return true;
  });
}

export function evidenceReadiness(record) {
  if (!record) return "missing";
  if (record.verificationStatus === "verified") return "verified";
  if (record.verificationStatus === "supported") return "supported";
  return "requires_source_verification";
}

export function canPresentAsVerifiedEvidence(record) {
  return ["verified", "supported"].includes(evidenceReadiness(record));
}
