import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const policy = JSON.parse(fs.readFileSync(path.join(root, "..", "config", "corpus-provenance-policy-2026.json"), "utf8"));

const VERIFIED = new Set(["source_verified", "edition_verified", "scholar_reviewed"]);

export function getCorpusProvenancePolicy() {
  return structuredClone(policy);
}

export function isVerifiedState(state) {
  return VERIFIED.has(String(state || ""));
}

export function validateCorpusRecord(record = {}) {
  const missing = policy.requiredFields.filter((field) => {
    if (field === "attribution") return !record.attribution || typeof record.attribution !== "object";
    return record[field] === undefined || record[field] === null || record[field] === "";
  });

  const errors = [...missing.map((field) => `missing:${field}`)];
  if (record.sourceType && !policy.sourceTypes.includes(record.sourceType)) errors.push(`unsupported-source-type:${record.sourceType}`);
  if (record.verificationState && !policy.verificationStates.includes(record.verificationState)) errors.push(`unsupported-verification-state:${record.verificationState}`);

  return {
    valid: errors.length === 0,
    errors,
    trusted: isVerifiedState(record.verificationState),
    recordId: record.recordId ?? null,
    sourceId: record.sourceId ?? null
  };
}

export function buildProvenance({ recordId, sourceId, sourceType, verificationState = "ingested", attribution = {}, citation = null, rights = null } = {}) {
  const record = { recordId, sourceId, sourceType, verificationState, attribution, citation, rights };
  const validation = validateCorpusRecord(record);
  if (!validation.valid) throw new TypeError(`Invalid corpus provenance: ${validation.errors.join(", ")}`);
  return {
    recordId,
    sourceId,
    sourceType,
    verificationState,
    trusted: validation.trusted,
    attribution,
    citation,
    rights
  };
}

export function summarizeCorpusProvenance(records = []) {
  const summary = { total: records.length, trusted: 0, pending: 0, invalid: 0, bySourceType: {} };
  for (const record of records) {
    const validation = validateCorpusRecord(record);
    if (!validation.valid) summary.invalid += 1;
    else if (validation.trusted) summary.trusted += 1;
    else summary.pending += 1;
    if (record.sourceType) summary.bySourceType[record.sourceType] = (summary.bySourceType[record.sourceType] || 0) + 1;
  }
  return summary;
}
