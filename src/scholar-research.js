import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import domainFramework from "../config/domain-scholar-framework.json" with { type: "json" };
import contemporary from "../config/contemporary-sunni-scholars.json" with { type: "json" };
import fiqhSources from "../config/fiqh-fatawa-sources.json" with { type: "json" };
import scholarRegistry from "../data/scholars/registry.json" with { type: "json" };
import { listBooks } from "./book-catalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const opinions = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "config", "scholar-opinions-index.json"), "utf8"));

const SCHOLAR_ALIASES = {
  ibn_taymiyyah: ["ابن تيمية", "أحمد بن تيمية", "تقي الدين ابن تيمية", "شيخ الإسلام ابن تيمية"],
};

function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase("ar")
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

function aliasesForScholar(scholar) {
  return [scholar?.nameAr, scholar?.id, ...(SCHOLAR_ALIASES[scholar?.id] || [])].filter(Boolean);
}

function allScholars() {
  const map = new Map();
  for (const record of scholarRegistry.records || []) {
    const current = map.get(record.id) || { id: record.id, nameAr: record.name_ar, domains: [], records: [] };
    current.catalogStatus = record.status || "candidate";
    current.era = record.era || null;
    current.verification = record.verification || "pending";
    current.inclusionBasis = record.inclusion_basis || "scholar-catalog-discovery";
    current.sourceRequired = record.source_required !== false;
    map.set(record.id, current);
  }
  for (const [domainId, domain] of Object.entries(domainFramework.domains || {})) {
    for (const scholar of domain.scholars || []) {
      const current = map.get(scholar.id) || { id: scholar.id, nameAr: scholar.nameAr, domains: [], records: [] };
      if (!current.domains.includes(domainId)) current.domains.push(domainId);
      current.nameAr = current.nameAr || scholar.nameAr;
      map.set(scholar.id, current);
    }
  }
  for (const scholar of contemporary.scholars || []) {
    const current = map.get(scholar.id) || { id: scholar.id, nameAr: scholar.nameAr, domains: [], records: [] };
    current.nameAr = current.nameAr || scholar.nameAr;
    current.role = scholar.role;
    current.sources = scholar.sources || [];
    current.contentTypes = scholar.contentTypes || [];
    map.set(scholar.id, current);
  }
  for (const scholar of fiqhSources.scholars || []) {
    const current = map.get(scholar.id) || { id: scholar.id, nameAr: scholar.nameAr, domains: [], records: [] };
    current.nameAr = current.nameAr || scholar.nameAr;
    current.fatwaSourceIds = scholar.sourceIds || [];
    map.set(scholar.id, current);
  }
  return [...map.values()];
}

function findScholar(nameOrId) {
  const needle = normalize(nameOrId);
  return allScholars().find((item) => aliasesForScholar(item).some((alias) => {
    const normalizedAlias = normalize(alias);
    return item.id === nameOrId || normalizedAlias === needle || normalizedAlias.includes(needle) || needle.includes(normalizedAlias);
  })) || null;
}

function sourceBooksForScholar(scholar) {
  if (!scholar) return [];
  return listBooks({ status: "verified" }).filter((book) => book.authorId === scholar.id || book.authorId === scholar.nameAr).slice(0, 100);
}

function normalizeOpinion(record) {
  const item = { ...record };
  item.verification = item.verification || "unverified";
  item.relationshipType = item.relationshipType || "biographical-testimony";
  item.wording = item.wording || null;
  item.sourceTitle = item.sourceTitle || null;
  item.sourceUrl = item.sourceUrl || null;
  item.citation = item.citation || null;
  item.context = item.context || null;
  item.dateOrEra = item.dateOrEra || null;
  return item;
}

export function getScholarResearchPolicy() {
  return {
    ...opinions.policy,
    requiredEvidenceFields: [...opinions.requiredEvidenceFields],
    relationshipTypes: [...opinions.relationshipTypes],
    verificationLevels: [...opinions.verificationLevels],
  };
}

export function searchScholarOpinions(query, { relationshipType, verification } = {}) {
  const q = normalize(query);
  if (!q) return [];
  return (opinions.records || []).map(normalizeOpinion).filter((item) => {
    const haystack = normalize([item.subjectScholarId, item.criticScholarId, item.wording, item.sourceTitle, item.context].join(" "));
    return haystack.includes(q) && (!relationshipType || item.relationshipType === relationshipType) && (!verification || item.verification === verification);
  });
}

export function searchScholars(query, { limit = 20, era, verifiedOnly = false } = {}) {
  const q = normalize(query);
  if (!q) return [];
  return allScholars()
    .filter((item) => !era || item.era === era)
    .filter((item) => !verifiedOnly || ["verified", "supported"].includes(item.verification))
    .map((item) => {
      const aliases = aliasesForScholar(item);
      const haystack = aliases.map(normalize).join(" ");
      const exactAlias = aliases.some((alias) => normalize(alias) === q);
      const partialAlias = aliases.some((alias) => {
        const normalizedAlias = normalize(alias);
        return normalizedAlias.includes(q) || q.includes(normalizedAlias);
      });
      const score = exactAlias ? 100 : partialAlias ? 90 : q.split(" ").filter((token) => haystack.includes(token)).length * 20;
      return { ...item, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.nameAr.localeCompare(b.nameAr, "ar"))
    .slice(0, Math.min(Math.max(Number(limit) || 20, 1), 100));
}

export function buildScholarResearchProfile(nameOrId) {
  const scholar = findScholar(nameOrId);
  if (!scholar) return null;
  const subjectRecords = (opinions.records || []).map(normalizeOpinion).filter((item) => item.subjectScholarId === scholar.id);
  const critics = subjectRecords.map((item) => item.criticScholarId).filter(Boolean);
  const criticProfiles = critics.map((id) => findScholar(id)).filter(Boolean);
  const evidence = subjectRecords.filter((item) => ["verified", "supported"].includes(item.verification));
  const disputed = subjectRecords.filter((item) => item.verification === "disputed" || item.disputed === true);

  return {
    scholar,
    identity: {
      id: scholar.id,
      nameAr: scholar.nameAr,
      role: scholar.role || null,
      domains: scholar.domains || [],
      contentTypes: scholar.contentTypes || [],
      era: scholar.era || null,
      catalogStatus: scholar.catalogStatus || "candidate",
      verification: scholar.verification || "pending",
      inclusionBasis: scholar.inclusionBasis || null,
    },
    primarySources: scholar.sources || [],
    fatwaSourceIds: scholar.fatwaSourceIds || [],
    authoredWorks: sourceBooksForScholar(scholar),
    opinions: {
      totalIndexed: subjectRecords.length,
      verifiedOrSupported: evidence.length,
      disputed: disputed.length,
      records: subjectRecords,
      criticsAndAssessors: criticProfiles,
    },
    synthesis: {
      status: subjectRecords.length ? "evidence-available" : "needs-indexed-evidence",
      rule: "لا يصدر ملخص ترجيحي إلا بعد جمع الأقوال الموثقة وحفظ الخلاف والسياق.",
      distinction: [
        "الحكم على العالم أو الراوي",
        "الحكم على قوله أو كتابه",
        "الحكم على حديث رواه",
        "تقييم منهجه في مجال محدد"
      ],
    },
  };
}

export function compareScholarOpinions(nameOrId) {
  const profile = buildScholarResearchProfile(nameOrId);
  if (!profile) return null;
  const records = profile.opinions.records;
  return {
    scholar: profile.identity,
    praise: records.filter((item) => item.relationshipType === "praise"),
    criticism: records.filter((item) => item.relationshipType === "criticism"),
    qualification: records.filter((item) => item.relationshipType === "qualification"),
    defense: records.filter((item) => item.relationshipType === "defense"),
    methodological: records.filter((item) => item.relationshipType.endsWith("-assessment")),
    disputed: records.filter((item) => item.verification === "disputed" || item.disputed === true),
    note: "المقارنة لا تعني ترجيح قول بمجرد كثرة القائلين؛ يلزم النظر في رتبة الناقد، وتاريخ قوله، وسياقه، ونص المصدر.",
  };
}

export function listScholarResearchCandidates({ query } = {}) {
  const q = normalize(query);
  return allScholars().filter((item) => !q || aliasesForScholar(item).some((alias) => normalize(alias).includes(q))).map((item) => ({
    ...item,
    evidenceCount: (opinions.records || []).filter((record) => record.subjectScholarId === item.id).length,
  }));
}
