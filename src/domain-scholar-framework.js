import framework from "../config/domain-scholar-framework.json" with { type: "json" };
import { buildScholarResearchProfile, compareScholarOpinions, getScholarResearchPolicy, searchScholars } from "./scholar-research.js";

export function listKnowledgeDomains() {
  return Object.entries(framework.domains).map(([id, domain]) => ({
    id,
    method: [...domain.method],
    scholars: domain.scholars.map((scholar) => ({ ...scholar })),
  }));
}

export function getDomainScholarFramework(domainId) {
  const domain = framework.domains[domainId];
  if (!domain) return null;
  return {
    id: domainId,
    method: [...domain.method],
    scholars: domain.scholars.map((scholar) => ({ ...scholar })),
    rules: { ...framework.researchRules },
  };
}

export function searchDomainScholars(query, domainId) {
  const q = String(query || "").trim().toLocaleLowerCase("ar");
  const domains = domainId ? [[domainId, framework.domains[domainId]]] : Object.entries(framework.domains);
  const domainResults = domains.flatMap(([id, domain]) => {
    if (!domain) return [];
    return domain.scholars
      .filter((scholar) => !q || scholar.nameAr.toLocaleLowerCase("ar").includes(q))
      .map((scholar) => ({
        ...scholar,
        domain: id,
        catalogStatus: "framework",
        researchProfile: buildScholarResearchProfile(scholar.id),
        opinionComparison: compareScholarOpinions(scholar.id),
      }));
  });
  if (domainId) return domainResults;
  const catalogResults = q
    ? searchScholars(query, { limit: 100 }).map((scholar) => ({
        id: scholar.id,
        nameAr: scholar.nameAr,
        domain: scholar.domains?.[0] || "scholar-catalog",
        domains: scholar.domains || [],
        era: scholar.era || null,
        catalogStatus: scholar.catalogStatus || "candidate",
        verification: scholar.verification || "pending",
        researchProfile: buildScholarResearchProfile(scholar.id),
        opinionComparison: compareScholarOpinions(scholar.id),
        score: scholar.score || 0,
      }))
    : [];
  const seen = new Set();
  return [...domainResults, ...catalogResults].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function getDomainResearchPolicy() {
  return { ...framework.researchRules, scholarOpinionResearch: getScholarResearchPolicy() };
}
