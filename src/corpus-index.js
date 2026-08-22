import fs from "node:fs";
import path from "node:path";

const DEFAULT_DIR = path.join(process.cwd(), "config");

export function normalizeQuery(value = "") {
  return String(value)
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function loadJson(file, dir = DEFAULT_DIR) {
  const full = path.join(dir, file);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

export function loadCorpusRecords(dir = DEFAULT_DIR) {
  const seed = loadJson("canonical-corpus-seed-2026.json", dir);
  return seed?.records ?? [];
}

export function buildCorpusIndex(records = []) {
  return records.map((record) => ({
    ...record,
    _searchText: normalizeQuery([
      record.titleOriginal,
      record.textOriginal,
      record.sourceId,
      record.sourceType,
      record.attribution?.authorOrScholar,
      record.attribution?.institution
    ].filter(Boolean).join(" "))
  }));
}

export function searchCorpus(query, options = {}, records = loadCorpusRecords()) {
  const q = normalizeQuery(query);
  if (!q) return [];
  const index = buildCorpusIndex(records);
  const type = options.sourceType;
  const verifiedOnly = options.verifiedOnly === true;

  return index
    .filter((r) => !type || r.sourceType === type)
    .filter((r) => !verifiedOnly || ["source-verified", "edition-verified", "institution-verified", "scholar-reviewed"].includes(r.reviewStatus))
    .map((r) => {
      const title = normalizeQuery(r.titleOriginal || "");
      const text = normalizeQuery(r.textOriginal || "");
      let score = 0;
      if (title === q) score += 100;
      if (title.includes(q)) score += 40;
      if (text.includes(q)) score += 20;
      if (normalizeQuery(r.sourceId).includes(q)) score += 10;
      return { record: r, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ record, score }) => ({ ...record, score }));
}

export function verifyRecord(record) {
  if (!record) return { verified: false, status: "record-not-found" };
  const hasCitation = Boolean(record.citation);
  const hasProvenance = Boolean(record.provenance);
  const status = record.reviewStatus || "ingested";
  return {
    verified: hasCitation && hasProvenance && status !== "ingested",
    status,
    sourceId: record.sourceId,
    citation: record.citation ?? null,
    provenance: record.provenance ?? null,
    rights: record.rights ?? null
  };
}
