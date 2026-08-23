import fs from "node:fs";
import path from "node:path";

const DEFAULT_DIR = path.join(process.cwd(), "config");
const VERIFIED_STATUSES = new Set(["source-verified", "edition-verified", "institution-verified", "scholar-reviewed"]);

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
      record.attribution?.institution,
      record.citation?.book,
      record.citation?.chapter,
      record.citation?.hadithNumber,
      record.citation?.verse
    ].filter(Boolean).join(" "))
  }));
}

function tokenScore(text, tokens) {
  if (!tokens.length) return 0;
  let hits = 0;
  for (const token of tokens) if (text.includes(token)) hits += 1;
  return hits / tokens.length;
}

export function searchCorpus(query, options = {}, records = loadCorpusRecords()) {
  const q = normalizeQuery(query);
  if (!q) return [];
  const tokens = q.split(" ").filter(Boolean);
  const index = buildCorpusIndex(records);
  const type = options.sourceType;
  const verifiedOnly = options.verifiedOnly === true;

  return index
    .filter((r) => !type || r.sourceType === type)
    .filter((r) => !verifiedOnly || verifyRecord(r).verified)
    .map((r) => {
      const title = normalizeQuery(r.titleOriginal || "");
      const text = normalizeQuery(r.textOriginal || "");
      const author = normalizeQuery(r.attribution?.authorOrScholar || "");
      const institution = normalizeQuery(r.attribution?.institution || "");
      const sourceId = normalizeQuery(r.sourceId || "");
      const searchText = r._searchText;
      let score = 0;

      if (title === q) score += 120;
      else if (title.includes(q)) score += 60;
      if (text.includes(q)) score += 35;
      if (sourceId.includes(q)) score += 20;
      if (author.includes(q)) score += 25;
      if (institution.includes(q)) score += 15;

      const tokenCoverage = tokenScore(searchText, tokens);
      score += Math.round(tokenCoverage * 30);
      if (tokenCoverage === 1 && tokens.length > 1) score += 15;
      if (VERIFIED_STATUSES.has(r.reviewStatus)) score += 5;

      return { record: r, score, tokenCoverage };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.tokenCoverage - a.tokenCoverage)
    .map(({ record, score }) => ({ ...record, score }));
}

export function verifyRecord(record) {
  if (!record) return { verified: false, status: "record-not-found" };
  const hasCitation = Boolean(record.citation);
  const hasProvenance = Boolean(record.provenance);
  const status = record.reviewStatus || "ingested";
  return {
    verified: hasCitation && hasProvenance && VERIFIED_STATUSES.has(status),
    status,
    sourceId: record.sourceId,
    citation: record.citation ?? null,
    provenance: record.provenance ?? null,
    rights: record.rights ?? null
  };
}
